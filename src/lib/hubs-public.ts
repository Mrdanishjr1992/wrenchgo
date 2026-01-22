import { supabase } from "./supabase";

export type HubPublicStats = {
  id: string;
  name: string;
  slug: string | null;
  zip: string | null;
  city: string | null;
  state: string | null;
  lat: number;
  lng: number;
  active_radius_miles: number;
  max_radius_miles: number;
  is_active: boolean;
  mechanic_count: number;
  customer_count: number;
  open_jobs: number;
};

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function getHubPublicStats(): Promise<HubPublicStats[]> {
  const { data, error } = await supabase.rpc("list_hubs_public");
  if (error) throw error;

  const rows = (data ?? []) as any[];
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: row.slug ?? null,
    zip: row.zip ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    lat: asNumber(row.lat),
    lng: asNumber(row.lng),
    active_radius_miles: asNumber(row.active_radius_miles),
    max_radius_miles: asNumber(row.max_radius_miles),
    is_active: Boolean(row.is_active),
    mechanic_count: asNumber(row.mechanic_count),
    customer_count: asNumber(row.customer_count),
    open_jobs: asNumber(row.open_jobs),
  }));
}
