export type LeadFilterType = 'all' | 'nearby' | 'quoted';
export type LeadSortType = 'newest' | 'closest';

export interface MechanicLead {
  job_id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  preferred_time: string | null;
  location_address: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_miles: number | null;
  customer_id: string;
  customer_name: string;
  customer_photo_url: string | null;  // Note: RPC returns this as customer_photo_url, mapped from avatar_url
  customer_rating: number;
  customer_review_count: number;
  vehicle_id: string | null;
  vehicle_year: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  has_quoted: boolean;
  quote_id: string | null;
  quote_amount: number | null;
  quote_status: string | null;
  quote_created_at: string | null;
  is_new: boolean;
}

export interface LeadsSummary {
  all_count: number;
  nearby_count: number;
  quoted_count: number;
}

export interface MechanicLeadsParams {
  mechanicId: string;
  filter: LeadFilterType;
  mechanicLat?: number | null;
  mechanicLng?: number | null;
  radiusMiles?: number;
  limit?: number;
  offset?: number;
  sortBy?: LeadSortType;
}
