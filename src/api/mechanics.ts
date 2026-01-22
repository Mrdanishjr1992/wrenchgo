import { supabase } from "../lib/supabase";

export type MechanicSearchRow = {
  id: string;
  full_name: string | null;
  shop_name: string | null;
  available_now: boolean | null;
  service_radius_miles: number | null;
  zip_code: string | null;
  lat: number | null;
  lng: number | null;
  photo_url: string | null;
};

export async function fetchMechanicsByZip(zip: string) {
  const zipClean = zip.replace(/\D/g, "").slice(0, 5);
  if (zipClean.length !== 5) throw new Error("Enter a 5-digit ZIP code.");

  const { data, error } = await supabase
    .from("mechanics_search")
    .select("id,full_name,shop_name,available_now,service_radius_miles,zip_code,lat,lng,profiles!inner(photo_url)")
    .eq("zip_code", zipClean)
    .eq("available_now", true);

  if (error) throw error;

  const mapped = (data ?? []).map((row: any) => ({
    id: row.id,
    full_name: row.full_name,
    shop_name: row.shop_name,
    available_now: row.available_now,
    service_radius_miles: row.service_radius_miles,
    zip_code: row.zip_code,
    lat: row.lat,
    lng: row.lng,
    photo_url: row.profiles?.photo_url ?? null,
  }));

  return mapped as MechanicSearchRow[];
}
