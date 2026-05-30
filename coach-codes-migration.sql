-- =============================================================================
-- CoachAnywhere — Coach Code Migration
-- -----------------------------------------------------------------------------
-- Adds support for coach invite codes alongside the existing athlete codes.
-- Both share the same pilot_codes table but distinguished by code_type.
--
-- Run AFTER the pilot-manual-payouts-migration. Safe to re-run.
-- =============================================================================

-- =============================================================================
-- 1) Add code_type column to pilot_codes
-- -----------------------------------------------------------------------------
-- Existing athlete codes (no code_type set) default to 'athlete' so we don't
-- break the existing flow. New coach codes use 'coach'.
-- =============================================================================
alter table pilot_codes
  add column if not exists code_type text not null default 'athlete';

create index if not exists pilot_codes_code_type_idx on pilot_codes(code_type);

-- Add a check constraint so only valid types are allowed
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pilot_codes_code_type_check'
  ) then
    alter table pilot_codes
      add constraint pilot_codes_code_type_check
      check (code_type in ('athlete', 'coach'));
  end if;
end $$;


-- =============================================================================
-- 2) Update validate_and_claim_pilot_code to enforce code_type
-- -----------------------------------------------------------------------------
-- New optional parameter p_expected_type. If 'athlete' is passed (or null,
-- for backwards compatibility), the function rejects coach codes and vice
-- versa. Also stops athletes accidentally redeeming coach codes.
-- =============================================================================
drop function if exists validate_and_claim_pilot_code(text, uuid);
drop function if exists validate_and_claim_pilot_code(text, uuid, text);

create or replace function validate_and_claim_pilot_code(
  p_code text,
  p_user_id uuid,
  p_expected_type text default 'athlete'
)
returns table (
  ok boolean,
  reason text,
  spots_remaining int
) language plpgsql security definer as $$
declare
  v_row pilot_codes%rowtype;
  v_used_count int;
  v_cap int;
begin
  -- Different caps per code type. Athletes hard-capped at 20; coaches are
  -- soft-managed via manual minting (cap is high so this never blocks).
  if p_expected_type = 'coach' then
    v_cap := 50;   -- generous; the real limit is how many codes you mint
  else
    v_cap := 20;
  end if;

  -- Count used codes of the requested type
  select count(*) into v_used_count
  from pilot_codes
  where used_at is not null and code_type = p_expected_type;

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

  -- Reject if code type doesn't match expected role
  if v_row.code_type != p_expected_type then
    return query select false, 'wrong_code_type'::text, (v_cap - v_used_count);
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
    -- Race: someone else just claimed it
    return query select false, 'already_used'::text, (v_cap - v_used_count);
    return;
  end if;

  return query select true, 'ok'::text, (v_cap - v_used_count - 1);
end;
$$;

grant execute on function validate_and_claim_pilot_code(text, uuid, text) to anon, authenticated;


-- =============================================================================
-- 3) Update pilot_spots_remaining to accept a type parameter
-- =============================================================================
drop function if exists pilot_spots_remaining();
drop function if exists pilot_spots_remaining(text);

create or replace function pilot_spots_remaining(p_code_type text default 'athlete')
returns int language sql security definer as $$
  select greatest(0,
    case p_code_type
      when 'coach' then 50
      else 20
    end
    - count(*)::int
  )
  from pilot_codes
  where used_at is not null and code_type = p_code_type;
$$;

grant execute on function pilot_spots_remaining(text) to anon, authenticated;


-- =============================================================================
-- VERIFICATION QUERIES (run separately to confirm)
-- =============================================================================
-- select code_type, count(*) from pilot_codes group by code_type;
-- select * from validate_and_claim_pilot_code('FAKE-CODE', gen_random_uuid(), 'coach');
-- select pilot_spots_remaining('athlete'), pilot_spots_remaining('coach');
