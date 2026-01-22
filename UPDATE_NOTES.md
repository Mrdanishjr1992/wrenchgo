# WrenchGo – Cleanup + Feature Hardening Notes

This package includes:

## 1) Service Area → Hub Assignment → Waitlist
- Added **/(auth)/service-area** screen to reliably collect ZIP and persist service area.
- Uses **set_my_service_area(zip, lat, lng)** so that:
  - `profiles.service_zip`, `profiles.service_lat/lng`, `profiles.hub_id` are set
  - `profiles.home_lat/lng` is kept in sync (required by `check_user_service_area`)
  - waitlist rows are created/updated automatically when out of active radius
- Added **/(auth)/waitlist** screen for out-of-range users.

## 2) Referral / Invite Code support during onboarding
- Service Area screen has an optional **Referral Code** input.
- Calls `accept_invitation(p_invite_code)` if provided (errors are non-blocking).

## 3) Hub Coverage Map + Counts (no mechanic location exposure)
- Fixed missing `src/lib/hubs-public.ts` used by the **/hubs** screen.
- `/hubs` uses the SQL RPC **list_hubs_public()** (aggregated counts only) so customers can:
  - view hub coverage circles
  - see mechanic/customer counts and open job counts
  - without seeing mechanic coordinates

## 4) Mechanic Schedule (Calendar View)
- Added **Schedule** tab for mechanics:
  - shows upcoming contracted jobs (from `job_contracts`)
  - displays customer + address summary

## 5) Admin Hub Scoping & Filters
- Implemented `useAdminScope()` to call `admin_get_scope()` (no more hardcoded super-admin).
- Updated admin filter enums to match current DB values (payment + waitlist status).

## 6) Supabase Migrations Squashed
- Supabase migrations are consolidated into **supabase/migrations/0001_baseline.sql**.
- The baseline contains all extensions, tables, types, functions, triggers, and RLS.

---

# Known follow-ups (still recommended)
- Add a **single source of truth** for status enums in UI (reuse DB enums when possible).
- Add automated smoke tests for:
  - onboarding -> hub assign -> waitlist
  - payments: authorize -> capture -> payout
  - admin scope restrictions
- Review RLS for waitlist + invitation tables if you expect heavy public traffic.

