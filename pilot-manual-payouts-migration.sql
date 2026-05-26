-- =============================================================================
-- CoachAnywhere — Pilot manual-payouts migration (B2)
-- -----------------------------------------------------------------------------
-- Run this in the Supabase SQL Editor AFTER the original pilot-migration.sql.
-- This is a follow-up that:
--   • Adds bank details columns to profiles (for coach payouts)
--   • Replaces pilot_topups with pilot_payouts (different semantics)
--   • Updates RPC functions to match the manual-payout flow
--
-- Safe to re-run — all schema changes use IF NOT EXISTS / OR REPLACE.
-- =============================================================================

-- =============================================================================
-- 1) Coach bank details on profiles
-- -----------------------------------------------------------------------------
-- We collect BSB + account number + account name during coach onboarding.
-- These are sensitive — RLS makes them readable only by the owning coach
-- (so they can edit them) and by the service-role webhook (which doesn't
-- need them since payouts are manual, but listing them is convenient).
-- =============================================================================
alter table profiles
  add column if not exists payout_bsb            text,
  add column if not exists payout_account_number text,
  add column if not exists payout_account_name   text,
  add column if not exists payout_method         text default 'bank-transfer';

-- Comment for posterity
comment on column profiles.payout_bsb is 'AU bank BSB (6 digits). Used for manual coach payouts during pilot.';
comment on column profiles.payout_account_number is 'AU bank account number. Used for manual coach payouts during pilot.';


-- =============================================================================
-- 2) Drop pilot_topups (Connect-specific) and replace with pilot_payouts
-- -----------------------------------------------------------------------------
-- pilot_topups was designed for the Connect flow (auto-transfers via Stripe).
-- In manual-payout mode we instead track each owed payout and let the admin
-- mark it as paid by hand. Schema is similar but semantics are different:
--   pending  → admin sees it in the "Due now" list
--   paid     → admin confirmed bank transfer sent
--   waived   → for refunds or special cases
-- =============================================================================
drop table if exists pilot_topups cascade;

create table if not exists pilot_payouts (
  id                  uuid primary key default gen_random_uuid(),
  coach_id            uuid not null references profiles(id),
  athlete_id          uuid not null references profiles(id),
  subscription_id     uuid references subscriptions(id),
  stripe_invoice_id   text,
  month               text not null,
  amount_cents        int not null,
  status              text not null default 'pending',
  paid_at             timestamptz,
  paid_by_admin_id    uuid references auth.users(id),
  payment_reference   text,
  notes               text,
  created_at          timestamptz default now(),

  unique (subscription_id, month)
);

create index if not exists pilot_payouts_status_idx   on pilot_payouts(status);
create index if not exists pilot_payouts_coach_id_idx on pilot_payouts(coach_id);
create index if not exists pilot_payouts_month_idx    on pilot_payouts(month);

alter table pilot_payouts enable row level security;

create policy "pilot_payouts_select_own"
  on pilot_payouts for select
  using (coach_id = auth.uid());


-- =============================================================================
-- 3) Per-coach earnings view
-- -----------------------------------------------------------------------------
-- Aggregates active pilot subscriptions per coach for the current month so
-- the coach dashboard can show "you'll be paid $X for Y athletes."
-- =============================================================================
create or replace view pilot_coach_earnings as
select
  s.coach_id,
  to_char(now() at time zone 'UTC', 'YYYY-MM')         as month,
  count(*)                                              as active_athletes,
  count(*) * 6000                                       as amount_cents,
  count(*) * 60                                         as amount_dollars
from subscriptions s
where s.is_pilot = true
  and s.status = 'active'
group by s.coach_id;

grant select on pilot_coach_earnings to authenticated;


-- =============================================================================
-- 4) Admin view — payouts due summary
-- -----------------------------------------------------------------------------
-- One row per coach with totals of what's pending vs paid this month.
-- Used by the admin panel to drive the "Pay these coaches" workflow.
-- =============================================================================
create or replace view pilot_payouts_admin_summary as
select
  p.coach_id,
  pr.first_name,
  pr.last_name,
  pr.email,
  pr.payout_bsb,
  pr.payout_account_number,
  pr.payout_account_name,
  to_char(p.created_at at time zone 'UTC', 'YYYY-MM') as month,
  sum(case when p.status = 'pending' then p.amount_cents else 0 end) as pending_cents,
  sum(case when p.status = 'paid'    then p.amount_cents else 0 end) as paid_cents,
  count(*) filter (where p.status = 'pending') as pending_count,
  count(*) filter (where p.status = 'paid')    as paid_count,
  max(p.created_at) as last_invoice_at
from pilot_payouts p
join profiles pr on pr.id = p.coach_id
group by p.coach_id, pr.first_name, pr.last_name, pr.email,
         pr.payout_bsb, pr.payout_account_number, pr.payout_account_name,
         to_char(p.created_at at time zone 'UTC', 'YYYY-MM');

grant select on pilot_payouts_admin_summary to authenticated;


-- =============================================================================
-- 5) Mark-as-paid RPC
-- -----------------------------------------------------------------------------
-- Admin clicks "Mark as paid" in the panel; this records who marked it,
-- when, and an optional payment reference (your bank transaction ID).
-- =============================================================================
create or replace function mark_pilot_payout_paid(
  p_payout_id uuid,
  p_admin_id  uuid,
  p_reference text default null,
  p_notes     text default null
) returns void language plpgsql security definer as $$
begin
  update pilot_payouts
  set status = 'paid',
      paid_at = now(),
      paid_by_admin_id = p_admin_id,
      payment_reference = p_reference,
      notes = p_notes
  where id = p_payout_id and status = 'pending';
end;
$$;

grant execute on function mark_pilot_payout_paid(uuid, uuid, text, text) to authenticated;


-- =============================================================================
-- VERIFICATION
-- =============================================================================
-- select column_name from information_schema.columns
-- where table_name = 'profiles' and column_name like 'payout%';
--
-- select * from pilot_payouts_admin_summary;
-- select * from pilot_coach_earnings;
