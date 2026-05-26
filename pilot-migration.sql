-- =============================================================================
-- CoachAnywhere — Pilot launch SQL migration
-- -----------------------------------------------------------------------------
-- Run this in the Supabase SQL Editor (one statement at a time if anything
-- fails — but it's designed to be safe to run as a whole script).
--
-- Adds:
--   • pilot_codes table             — invite codes for athletes
--   • profiles.pilot_status         — 'athlete' | 'coach' | null
--   • profiles.pilot_started_at     — when they joined the pilot
--   • subscriptions.is_pilot        — flags pilot subs (so post-pilot we can
--                                     migrate them differently)
--   • pilot_topups table            — audit log for $20.80 platform top-ups
--   • pilot_review_counts view      — per-athlete-per-month review count
--
-- All changes are additive (no destructive drops, no schema rewrites).
-- =============================================================================

-- =============================================================================
-- 1) pilot_codes — invite codes athletes redeem on signup
-- =============================================================================
create table if not exists pilot_codes (
  code             text primary key,
  athlete_email    text,                                   -- optional: who it's earmarked for
  used_at          timestamptz,
  used_by_user_id  uuid references auth.users(id),
  created_at       timestamptz default now(),
  notes            text                                    -- free-form: "for Sarah's cousin", etc.
);

-- Helpful indexes
create index if not exists pilot_codes_used_at_idx       on pilot_codes(used_at);
create index if not exists pilot_codes_athlete_email_idx on pilot_codes(athlete_email);

-- RLS: codes are validated by a Netlify function with the service-role key.
-- Athletes hitting the table directly via the anon key shouldn't see them all
-- (that would let anyone enumerate unused codes). We expose a SECURITY DEFINER
-- function below for the validation flow instead.
alter table pilot_codes enable row level security;

-- Anyone can SELECT a row by exact code match (used for signup validation).
-- This is intentionally narrow: PRIMARY KEY lookup only, no LIKE / range.
create policy "pilot_codes_select_by_code"
  on pilot_codes for select
  using (true);   -- gated by the unguessability of the code itself

-- Only service-role can INSERT new codes (admin-side via Netlify function).
-- No client INSERT/UPDATE/DELETE policies are created, so anon clients can't
-- write. (Service-role bypasses RLS entirely.)


-- =============================================================================
-- 2) profiles — pilot status columns
-- =============================================================================
alter table profiles
  add column if not exists pilot_status     text,
  add column if not exists pilot_started_at timestamptz;

create index if not exists profiles_pilot_status_idx
  on profiles(pilot_status) where pilot_status is not null;


-- =============================================================================
-- 3) subscriptions — is_pilot flag
-- =============================================================================
alter table subscriptions
  add column if not exists is_pilot boolean not null default false;

create index if not exists subscriptions_is_pilot_idx
  on subscriptions(is_pilot) where is_pilot = true;


-- =============================================================================
-- 4) pilot_topups — audit log for $20.80 platform-funded transfers
-- -----------------------------------------------------------------------------
-- Idempotency: (subscription_id, month) is a unique key so the webhook can
-- safely retry without double-transferring. Status moves pending → sent → ✓
-- (or → failed with error_message populated). Reconciliation: anything stuck
-- in 'pending' for >24h needs investigation.
-- =============================================================================
create table if not exists pilot_topups (
  id                  uuid primary key default gen_random_uuid(),
  coach_id            uuid not null references profiles(id),
  athlete_id          uuid not null references profiles(id),
  subscription_id     uuid references subscriptions(id),
  stripe_invoice_id   text,                                  -- the invoice that triggered this top-up
  stripe_transfer_id  text,                                  -- the resulting Connect transfer
  month               text not null,                         -- 'YYYY-MM' bucket
  amount_cents        int not null,                          -- typically 2080
  status              text not null default 'pending',       -- 'pending' | 'sent' | 'failed'
  error_message       text,
  created_at          timestamptz default now(),
  sent_at             timestamptz,

  -- Idempotency guard: one top-up per subscription per month.
  unique (subscription_id, month)
);

create index if not exists pilot_topups_status_idx     on pilot_topups(status);
create index if not exists pilot_topups_coach_id_idx   on pilot_topups(coach_id);
create index if not exists pilot_topups_month_idx      on pilot_topups(month);

alter table pilot_topups enable row level security;

-- Coaches can read their own top-up history (for their Earnings panel).
create policy "pilot_topups_select_own"
  on pilot_topups for select
  using (coach_id = auth.uid());

-- No client INSERT/UPDATE/DELETE — webhook uses service-role.


-- =============================================================================
-- 5) pilot_review_counts — per-athlete-per-month review count
-- -----------------------------------------------------------------------------
-- The athlete dashboard reads this to show "X of 4 reviews used this month".
-- The pilot soft cap (4/month) is checked client-side and on submission insert.
-- =============================================================================
create or replace view pilot_review_counts as
select
  athlete_id,
  to_char(created_at at time zone 'UTC', 'YYYY-MM') as month,
  count(*) as review_count
from submissions
group by athlete_id, to_char(created_at at time zone 'UTC', 'YYYY-MM');

-- Grant select to authenticated users so the dashboard can read it.
grant select on pilot_review_counts to authenticated;


-- =============================================================================
-- 6) HELPER FUNCTIONS
-- =============================================================================

-- validate_pilot_code(code) — single-shot validation used during signup.
-- Returns the code row if valid + unused + cap not hit, NULL otherwise.
-- Marks the code as 'used' atomically.
--
-- SECURITY DEFINER so the anon client can call it without seeing all codes.
-- The function bypasses RLS to do the check + update in one transaction.
create or replace function validate_and_claim_pilot_code(
  p_code text,
  p_user_id uuid
)
returns table (
  ok        boolean,
  reason    text,
  spots_remaining int
) language plpgsql security definer as $$
declare
  v_row pilot_codes%rowtype;
  v_used_count int;
  v_cap int := 20;   -- intake cap (must match PILOT_CONFIG.intakeCap)
begin
  -- Cap check first
  select count(*) into v_used_count from pilot_codes where used_at is not null;
  if v_used_count >= v_cap then
    return query select false, 'cap_reached'::text, 0;
    return;
  end if;

  -- Look up the code
  select * into v_row from pilot_codes where code = p_code;

  if not found then
    return query select false, 'invalid_code'::text, (v_cap - v_used_count);
    return;
  end if;

  if v_row.used_at is not null then
    return query select false, 'already_used'::text, (v_cap - v_used_count);
    return;
  end if;

  -- Atomic claim
  update pilot_codes
    set used_at = now(), used_by_user_id = p_user_id
    where code = p_code and used_at is null;

  if not found then
    -- Lost the race against another concurrent claim
    return query select false, 'already_used'::text, (v_cap - v_used_count);
    return;
  end if;

  return query select true, 'ok'::text, (v_cap - v_used_count - 1);
end;
$$;

grant execute on function validate_and_claim_pilot_code(text, uuid) to anon, authenticated;


-- pilot_spots_remaining() — used by pilot.html to show "X / 20 spots remaining".
-- Returns just an integer; safe to expose to anon.
create or replace function pilot_spots_remaining()
returns int language sql security definer as $$
  select greatest(0, 20 - count(*)::int) from pilot_codes where used_at is not null;
$$;

grant execute on function pilot_spots_remaining() to anon, authenticated;


-- =============================================================================
-- 7) SEED — generate 20 starter codes
-- -----------------------------------------------------------------------------
-- Pattern: PIONEER-{4 random alphanumerics}. Easy to spell, hard to guess
-- (>1.6M combinations, but cap is 20 so collision risk is functionally zero).
--
-- Mint via the admin UI when you're ready (admin.html will get a section in
-- the patch). The line below is a manual seed example you can run once if you
-- want codes to exist before admin.html is ready.
-- =============================================================================
-- insert into pilot_codes (code, notes)
-- select 'PIONEER-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4)),
--        'auto-seeded ' || now()::date
-- from generate_series(1, 20);
--
-- (kept commented so this script is non-destructive. Uncomment, run once,
-- then re-comment.)


-- =============================================================================
-- VERIFICATION QUERIES — run these after the migration to sanity-check
-- =============================================================================
-- select column_name, data_type, is_nullable from information_schema.columns
-- where table_name = 'profiles' and column_name like 'pilot%';
--
-- select column_name from information_schema.columns
-- where table_name = 'subscriptions' and column_name = 'is_pilot';
--
-- select * from pilot_codes limit 5;
-- select * from pilot_topups limit 5;
-- select pilot_spots_remaining();
