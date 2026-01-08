// Service Area Enforcement
// Ring-based expansion for location-restricted marketplace
// Launch Hub: 60453 (Oak Lawn, IL)

import { supabase } from './supabase';

export interface ServiceAreaStatus {
  allowed: boolean;
  hubId: string | null;
  hubName: string | null;
  hubSlug: string | null;
  distanceMiles: number | null;
  activeRadiusMiles: number | null;
  ring: number | null; // 0-3 or 99 for future
  boundaryStatus: 'inside' | 'near_boundary' | 'outside' | 'future_ring';
  inviteOnly: boolean;
  message: string;
}

export interface GeoLocation {
  lat: number;
  lng: number;
  city?: string;
  state?: string;
}

export interface WaitlistEntry {
  email: string;
  phone?: string;
  zip: string;
  userType: 'customer' | 'mechanic';
  serviceNeeded?: string;
  servicesOffered?: string[];
  yearsExperience?: number;
  willingTravelMiles?: number;
}

// Ring definitions
const RING_BOUNDARIES = [25, 50, 75, 100];

function getRing(distanceMiles: number): number {
  if (distanceMiles <= 25) return 0;
  if (distanceMiles <= 50) return 1;
  if (distanceMiles <= 75) return 2;
  if (distanceMiles <= 100) return 3;
  return 99; // Future expansion
}

const BOUNDARY_BUFFER_MILES = 5;

// Generate location hash for fraud detection (React Native compatible)
export function hashLocation(lat: number, lng: number): string {
  // Round to ~1 mile precision to allow minor GPS drift
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLng = Math.round(lng * 100) / 100;
  // Simple hash for React Native (no crypto module)
  const str = `${roundedLat}:${roundedLng}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ZIP to coordinates (static DB first, API fallback)
export async function zipToLocation(zip: string): Promise<GeoLocation | null> {
  const cleanZip = zip.substring(0, 5).replace(/\D/g, '');
  if (cleanZip.length !== 5) return null;

  // 1. Check static DB
  const { data } = await supabase
    .from('zip_codes')
    .select('lat, lng, city, state')
    .eq('zip', cleanZip)
    .single();

  if (data) return data;

  // 2. Fallback to Mapbox (only if configured)
  const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!mapboxToken) return null;

  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${cleanZip}.json?country=US&types=postcode&access_token=${mapboxToken}`
    );
    const result = await response.json();

    if (result.features?.[0]) {
      const [lng, lat] = result.features[0].center;
      const city = result.features[0].context?.find((c: any) => c.id.startsWith('place'))?.text;
      const state = result.features[0].context?.find((c: any) => c.id.startsWith('region'))?.short_code?.replace('US-', '');
      
      // Cache for future use
      await supabase.from('zip_codes').upsert({ zip: cleanZip, lat, lng, city, state }).select();
      
      return { lat, lng, city, state };
    }
  } catch (e) {
    console.error('Mapbox geocoding error:', e);
  }

  return null;
}

// Full address geocoding (for job creation - more precise)
export async function addressToLocation(address: string): Promise<GeoLocation | null> {
  const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!mapboxToken) return null;

  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?country=US&types=address&access_token=${mapboxToken}`
    );
    const result = await response.json();

    if (result.features?.[0]) {
      const [lng, lat] = result.features[0].center;
      return { lat, lng };
    }
  } catch (e) {
    console.error('Address geocoding error:', e);
  }

  return null;
}

// Check service area status with ring info
export async function checkServiceArea(
  lat: number,
  lng: number
): Promise<ServiceAreaStatus> {
  const { data, error } = await supabase
    .rpc('get_nearest_hub', { check_lat: lat, check_lng: lng })
    .single();

  if (error || !data) {
    return {
      allowed: false,
      hubId: null,
      hubName: null,
      hubSlug: null,
      distanceMiles: null,
      activeRadiusMiles: null,
      ring: null,
      boundaryStatus: 'outside',
      inviteOnly: true,
      message: 'Unable to verify service area',
    };
  }

  // Type the response
  const hubData = data as {
    hub_id: string;
    hub_name: string;
    hub_slug: string;
    distance_miles: number;
    radius_miles: number;
    active_radius_miles?: number;
    is_within_area: boolean;
    invite_only?: boolean;
  };

  const ring = getRing(hubData.distance_miles);
  const activeRadius = hubData.active_radius_miles || hubData.radius_miles;
  const isWithinActiveRadius = hubData.distance_miles <= activeRadius;
  const distanceFromBoundary = activeRadius - hubData.distance_miles;

  let boundaryStatus: 'inside' | 'near_boundary' | 'outside' | 'future_ring';

  if (isWithinActiveRadius) {
    boundaryStatus = distanceFromBoundary <= BOUNDARY_BUFFER_MILES ? 'near_boundary' : 'inside';
  } else if (hubData.distance_miles <= hubData.radius_miles) {
    boundaryStatus = 'future_ring'; // Within max but not active
  } else {
    boundaryStatus = 'outside';
  }

  let message: string;
  if (isWithinActiveRadius) {
    if (boundaryStatus === 'near_boundary') {
      message = `You're near the edge of our ${hubData.hub_name} service area. Some services may have limited availability.`;
    } else {
      message = `Welcome! You're in our ${hubData.hub_name} service area.`;
    }
  } else if (boundaryStatus === 'future_ring') {
    message = `We're expanding to your area soon! You're in Ring ${ring} (${RING_BOUNDARIES[ring - 1] || 75}-${RING_BOUNDARIES[ring] || 100} miles). Join the waitlist to be first.`;
  } else {
    message = `We're not in your area yet. You're ${hubData.distance_miles} miles from our ${hubData.hub_name} service area.`;
  }

  return {
    allowed: isWithinActiveRadius,
    hubId: hubData.hub_id,
    hubName: hubData.hub_name,
    hubSlug: hubData.hub_slug,
    distanceMiles: hubData.distance_miles,
    activeRadiusMiles: activeRadius,
    ring,
    boundaryStatus,
    inviteOnly: hubData.invite_only ?? true,
    message,
  };
}

// Validate location by ZIP (for signup/waitlist)
export async function validateLocationByZip(zip: string): Promise<ServiceAreaStatus> {
  const location = await zipToLocation(zip);
  if (!location) {
    return {
      allowed: false,
      hubId: null,
      hubName: null,
      hubSlug: null,
      distanceMiles: null,
      activeRadiusMiles: null,
      ring: null,
      boundaryStatus: 'outside',
      inviteOnly: true,
      message: 'Invalid ZIP code',
    };
  }
  return checkServiceArea(location.lat, location.lng);
}

// Validate location by address (for job creation - more precise)
export async function validateLocationByAddress(address: string): Promise<ServiceAreaStatus & { lat?: number; lng?: number }> {
  const location = await addressToLocation(address);
  if (!location) {
    return {
      allowed: false,
      hubId: null,
      hubName: null,
      hubSlug: null,
      distanceMiles: null,
      activeRadiusMiles: null,
      ring: null,
      boundaryStatus: 'outside',
      inviteOnly: true,
      message: 'Unable to verify address',
    };
  }
  const status = await checkServiceArea(location.lat, location.lng);
  return { ...status, lat: location.lat, lng: location.lng };
}

// Join waitlist with full mechanic/customer data
export async function joinWaitlist(entry: WaitlistEntry): Promise<{ success: boolean; message: string; ring?: number }> {
  const location = await zipToLocation(entry.zip);
  const status = location ? await checkServiceArea(location.lat, location.lng) : null;

  const { error } = await supabase.from('waitlist').upsert({
    email: entry.email,
    phone: entry.phone,
    zip: entry.zip.substring(0, 5),
    lat: location?.lat,
    lng: location?.lng,
    nearest_hub_id: status?.hubId,
    distance_miles: status?.distanceMiles,
    user_type: entry.userType,
    service_needed: entry.serviceNeeded,
    services_offered: entry.servicesOffered,
    years_experience: entry.yearsExperience,
    willing_travel_miles: entry.willingTravelMiles,
  }, { onConflict: 'email,zip' });

  if (error) {
    console.error('Waitlist error:', error);
    return { success: false, message: 'Failed to join waitlist' };
  }

  const ring = status?.ring;
  let message: string;

  if (ring !== null && ring !== undefined && ring <= 3) {
    message = `You're on the list for Ring ${ring}! We'll notify you when we expand to your area.`;
  } else if (status?.hubName) {
    message = `You're on the list! We'll notify you when we expand toward your area (${status.distanceMiles} miles from ${status.hubName}).`;
  } else {
    message = "You're on the list! We'll notify you when we launch in your area.";
  }

  return { success: true, message, ring: ring ?? undefined };
}

// Simple waitlist join (backward compatible)
export async function joinWaitlistSimple(
  email: string,
  zip: string,
  userType: 'customer' | 'mechanic'
): Promise<{ success: boolean; message: string }> {
  return joinWaitlist({ email, zip, userType });
}

// Log location check for security audit
export async function logLocationCheck(
  userId: string | null,
  action: string,
  claimedLat: number,
  claimedLng: number,
  claimedZip?: string,
  ipLat?: number,
  ipLng?: number
): Promise<void> {
  let distanceDelta: number | null = null;
  let flagged = false;

  // Calculate distance between claimed and IP location
  if (ipLat && ipLng) {
    distanceDelta = haversineDistance(claimedLat, claimedLng, ipLat, ipLng);
    flagged = distanceDelta > 500; // Flag if >500 miles apart
  }

  await supabase.from('location_audit').insert({
    user_id: userId,
    action,
    claimed_lat: claimedLat,
    claimed_lng: claimedLng,
    claimed_zip: claimedZip,
    ip_lat: ipLat,
    ip_lng: ipLng,
    distance_delta_miles: distanceDelta,
    flagged,
  });
}

// Haversine distance calculation
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
