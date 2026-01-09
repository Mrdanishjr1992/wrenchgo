// supabase/functions/_shared/helpers.ts

export function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function getOrigin(req: Request): string | null {
  return req.headers.get("origin");
}

// Optional: set ALLOWED_ORIGINS="https://app.wrenchgo.com,https://staging.wrenchgo.com"
// If unset, it allows all origins.
export function isAllowedOrigin(origin: string | null): boolean {
  const raw = (Deno.env.get("ALLOWED_ORIGINS") || "").trim();
  if (!raw) return true;
  if (!origin) return false;
  const allowed = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return allowed.includes(origin);
}

export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = getOrigin(req);
  const allowOrigin = isAllowedOrigin(origin) ? (origin ?? "*") : "null";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export function json(status: number, body: unknown, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
