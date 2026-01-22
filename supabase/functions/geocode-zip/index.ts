import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeocodeRequest {
  zip: string;
  country?: string;
}

interface GeocodeResponse {
  lat: number;
  lng: number;
  city?: string;
  state?: string;
  error?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { zip, country = "US" }: GeocodeRequest = await req.json();

    if (!zip || !/^\d{5}(-\d{4})?$/.test(zip)) {
      return new Response(
        JSON.stringify({ error: "Invalid ZIP code format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const zip5 = zip.substring(0, 5);
    const query = encodeURIComponent(`${zip5}, ${country}`);
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?postalcode=${zip5}&country=${country}&format=json&limit=1&addressdetails=1`;

    const response = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": "WrenchGo-Admin/1.0 (contact@wrenchgo.com)",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const results = await response.json();

    if (!results || results.length === 0) {
      return new Response(
        JSON.stringify({ error: "ZIP code not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = results[0];
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return new Response(
        JSON.stringify({ error: "Invalid coordinates returned" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geocodeResponse: GeocodeResponse = {
      lat,
      lng,
      city: result.address?.city || result.address?.town || result.address?.village || undefined,
      state: result.address?.state || undefined,
    };

    return new Response(
      JSON.stringify(geocodeResponse),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Geocode error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to geocode ZIP code" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
