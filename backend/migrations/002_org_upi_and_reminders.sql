-- Organisation UPI fields + RPC update for onboarding

alter table organisations add column if not exists upi_id text;
alter table organisations add column if not exists upi_number text;

create or replace function create_organisation_with_users_plans(payload jsonb)
returns uuid
language plpgsql
as $$
declare
  new_org_id uuid;
  user_count int;
  plan_count int;
  u jsonb;
  p jsonb;
begin
  user_count := jsonb_array_length(coalesce(payload->'users', '[]'::jsonb));
  plan_count := jsonb_array_length(coalesce(payload->'plans', '[]'::jsonb));

  if user_count < 2 then
    raise exception 'USER_MIN_REQUIRED' using errcode = 'P0001';
  end if;
  if plan_count < 1 or plan_count > 5 then
    raise exception 'PLAN_LIMIT_EXCEEDED' using errcode = 'P0001';
  end if;

  insert into organisations (
    name, type, custom_type, logo_url, address, maps_url, upi_id, upi_number
  )
  values (
    payload->>'name',
    payload->>'type',
    payload->>'custom_type',
    payload->>'logo_url',
    payload->>'address',
    payload->>'maps_url',
    payload->>'upi_id',
    payload->>'upi_number'
  )
  returning id into new_org_id;

  for u in select * from jsonb_array_elements(payload->'users') loop
    insert into users (
      organisation_id, full_name, username, mobile, email, password_hash, role
    ) values (
      new_org_id,
      u->>'full_name',
      u->>'username',
      u->>'mobile',
      u->>'email',
      u->>'password_hash',
      coalesce(u->>'role', 'staff')
    );
  end loop;

  for p in select * from jsonb_array_elements(payload->'plans') loop
    insert into plans (
      organisation_id, name, amount, billing_cycle, description
    ) values (
      new_org_id,
      p->>'name',
      (p->>'amount')::numeric,
      coalesce(p->>'billing_cycle', 'monthly'),
      p->>'description'
    );
  end loop;

  return new_org_id;
end;
$$;
