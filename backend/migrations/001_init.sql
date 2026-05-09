-- =============================================================================
-- Saathpay Admin Console — initial schema
--
-- Apply via Supabase SQL editor (paste + run) or:
--   psql "$DATABASE_URL" -f migrations/001_init.sql
--
-- Idempotent: safe to re-run.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- Saathpay internal team (console login)
create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  username text unique not null,
  email text unique not null,
  password_hash text not null,
  role text not null default 'superadmin',
  created_at timestamptz not null default now()
);

-- Organisations
create table if not exists organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  custom_type text,
  logo_url text,
  address text,
  maps_url text,
  status text not null default 'active' check (status in ('active','paused')),
  created_at timestamptz not null default now()
);

-- Per-organisation staff (NOT used for admin console login)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  full_name text not null,
  username text unique not null,
  mobile text not null,
  email text unique not null,
  password_hash text not null,
  role text not null default 'staff' check (role in ('admin','staff')),
  created_at timestamptz not null default now()
);

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  amount numeric(10,2) not null,
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly','quarterly','annual')),
  description text,
  created_at timestamptz not null default now()
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  plan_id uuid references plans(id),
  full_name text not null,
  mobile text not null,
  email text,
  join_date date,
  next_due_date date,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  channel text not null check (channel in ('whatsapp','sms')),
  status text not null default 'sent' check (status in ('sent','delivered','failed','queued','undelivered','read')),
  twilio_sid text,
  body text,
  error text,
  sent_at timestamptz not null default now()
);

create table if not exists settings (
  id int primary key default 1,
  messaging_enabled boolean not null default true,
  sms_fallback_enabled boolean not null default true,
  twilio_whatsapp_cost numeric(6,4) not null default 0.0050,
  twilio_sms_cost numeric(6,4) not null default 0.0025,
  twilio_account_sid text,
  twilio_auth_token text,
  whatsapp_sender text,
  sms_sender text,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

insert into settings (id) values (1) on conflict (id) do nothing;

create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('info','warning','error')),
  event text not null,
  organisation_id uuid references organisations(id) on delete set null,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- CSV import staging (two-step flow)
create table if not exists member_imports (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  admin_user_id uuid references admin_users(id) on delete set null,
  rows jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','confirmed','expired')),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

create index if not exists idx_users_organisation_id on users(organisation_id);
create index if not exists idx_plans_organisation_id on plans(organisation_id);
create index if not exists idx_members_organisation_id on members(organisation_id);
create index if not exists idx_members_organisation_plan on members(organisation_id, plan_id);
create index if not exists idx_messages_organisation_sent on messages(organisation_id, sent_at desc);
create index if not exists idx_messages_twilio_sid on messages(twilio_sid);
create index if not exists idx_logs_org_created on logs(organisation_id, created_at desc);
create index if not exists idx_logs_created_at on logs(created_at desc);
create index if not exists idx_member_imports_org on member_imports(organisation_id);

-- -----------------------------------------------------------------------------
-- Row Level Security: enable on every table; service-role connections bypass.
-- -----------------------------------------------------------------------------

alter table admin_users     enable row level security;
alter table organisations   enable row level security;
alter table users           enable row level security;
alter table plans           enable row level security;
alter table members         enable row level security;
alter table messages        enable row level security;
alter table settings        enable row level security;
alter table logs            enable row level security;
alter table member_imports  enable row level security;

-- No policies are created. The FastAPI service uses the service-role key,
-- which bypasses RLS. Direct anon/authenticated access from clients is blocked
-- by default.

-- -----------------------------------------------------------------------------
-- RPC: atomic organisation onboarding
-- -----------------------------------------------------------------------------
-- payload shape:
-- {
--   "name": "...", "type": "...", "custom_type": "...",
--   "logo_url": "...", "address": "...", "maps_url": "...",
--   "users": [
--     { "full_name": "...", "username": "...", "mobile": "...",
--       "email": "...", "password_hash": "<bcrypt>", "role": "admin" }, ...
--   ],
--   "plans": [
--     { "name": "...", "amount": 999.0, "billing_cycle": "monthly",
--       "description": "..." }, ...
--   ]
-- }
-- Returns the new organisation id. Raises on validation failure.
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

  insert into organisations (name, type, custom_type, logo_url, address, maps_url)
  values (
    payload->>'name',
    payload->>'type',
    payload->>'custom_type',
    payload->>'logo_url',
    payload->>'address',
    payload->>'maps_url'
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

-- -----------------------------------------------------------------------------
-- RPC: organisations list with member/message-this-month counts
-- -----------------------------------------------------------------------------
create or replace function org_list_with_counts(
  p_status text default null,
  p_search text default null,
  p_limit  int  default 25,
  p_offset int  default 0
)
returns table (
  id uuid,
  name text,
  type text,
  custom_type text,
  logo_url text,
  address text,
  maps_url text,
  status text,
  created_at timestamptz,
  member_count bigint,
  message_count_month bigint,
  total_count bigint
)
language sql
stable
as $$
  with filtered as (
    select o.*
    from organisations o
    where (p_status is null or o.status = p_status)
      and (p_search is null or o.name ilike '%' || p_search || '%')
  ),
  total as (
    select count(*)::bigint as c from filtered
  )
  select
    f.id, f.name, f.type, f.custom_type, f.logo_url, f.address, f.maps_url,
    f.status, f.created_at,
    coalesce((select count(*) from members m where m.organisation_id = f.id), 0)::bigint as member_count,
    coalesce((
      select count(*) from messages msg
      where msg.organisation_id = f.id
        and msg.sent_at >= date_trunc('month', now())
    ), 0)::bigint as message_count_month,
    (select c from total) as total_count
  from filtered f
  order by f.created_at desc
  limit p_limit offset p_offset;
$$;

-- -----------------------------------------------------------------------------
-- RPC: analytics summary
-- -----------------------------------------------------------------------------
create or replace function analytics_summary(
  p_start timestamptz,
  p_end   timestamptz
)
returns table (
  total_orgs bigint,
  total_members bigint,
  total_messages bigint,
  whatsapp_count bigint,
  sms_count bigint
)
language sql
stable
as $$
  select
    (select count(*) from organisations)::bigint as total_orgs,
    (select count(*) from members)::bigint as total_members,
    coalesce(count(*) filter (where m.sent_at >= p_start and m.sent_at < p_end), 0)::bigint as total_messages,
    coalesce(count(*) filter (where m.channel = 'whatsapp' and m.sent_at >= p_start and m.sent_at < p_end), 0)::bigint as whatsapp_count,
    coalesce(count(*) filter (where m.channel = 'sms'      and m.sent_at >= p_start and m.sent_at < p_end), 0)::bigint as sms_count
  from messages m;
$$;

-- -----------------------------------------------------------------------------
-- RPC: messages timeseries (group by day | week | month)
-- -----------------------------------------------------------------------------
create or replace function analytics_messages_timeseries(
  p_start  timestamptz,
  p_end    timestamptz,
  p_org_id uuid default null,
  p_bucket text default 'day'
)
returns table (
  bucket timestamptz,
  whatsapp bigint,
  sms bigint,
  total bigint
)
language plpgsql
stable
as $$
declare
  v_bucket text;
begin
  if p_bucket not in ('day','week','month') then
    v_bucket := 'day';
  else
    v_bucket := p_bucket;
  end if;

  return query
  select
    date_trunc(v_bucket, m.sent_at) as bucket,
    count(*) filter (where m.channel = 'whatsapp')::bigint as whatsapp,
    count(*) filter (where m.channel = 'sms')::bigint as sms,
    count(*)::bigint as total
  from messages m
  where m.sent_at >= p_start
    and m.sent_at < p_end
    and (p_org_id is null or m.organisation_id = p_org_id)
  group by 1
  order by 1;
end;
$$;

-- -----------------------------------------------------------------------------
-- RPC: cost timeseries
-- -----------------------------------------------------------------------------
create or replace function analytics_cost_timeseries(
  p_start   timestamptz,
  p_end     timestamptz,
  p_org_id  uuid       default null,
  p_bucket  text       default 'day',
  p_wa_cost numeric    default 0.0050,
  p_sms_cost numeric   default 0.0025
)
returns table (
  bucket timestamptz,
  whatsapp_count bigint,
  sms_count bigint,
  whatsapp_cost numeric,
  sms_cost numeric,
  cost numeric
)
language plpgsql
stable
as $$
declare
  v_bucket text;
begin
  if p_bucket not in ('day','week','month') then
    v_bucket := 'day';
  else
    v_bucket := p_bucket;
  end if;

  return query
  select
    date_trunc(v_bucket, m.sent_at) as bucket,
    count(*) filter (where m.channel = 'whatsapp')::bigint as whatsapp_count,
    count(*) filter (where m.channel = 'sms')::bigint as sms_count,
    (count(*) filter (where m.channel = 'whatsapp') * p_wa_cost)::numeric as whatsapp_cost,
    (count(*) filter (where m.channel = 'sms') * p_sms_cost)::numeric as sms_cost,
    (count(*) filter (where m.channel = 'whatsapp') * p_wa_cost
     + count(*) filter (where m.channel = 'sms') * p_sms_cost)::numeric as cost
  from messages m
  where m.sent_at >= p_start
    and m.sent_at < p_end
    and (p_org_id is null or m.organisation_id = p_org_id)
  group by 1
  order by 1;
end;
$$;

-- -----------------------------------------------------------------------------
-- Seed: initial admin user (UNCOMMENT and replace password_hash)
--
-- Generate the hash with:
--   uv run python -c "from passlib.hash import bcrypt; print(bcrypt.hash('YourSecurePass123'))"
-- -----------------------------------------------------------------------------
--
-- insert into admin_users (full_name, username, email, password_hash, role)
-- values (
--   'Saathpay Admin',
--   'admin',
--   'admin@saathpay.local',
--   '$2b$12$REPLACE_WITH_BCRYPT_HASH',
--   'superadmin'
-- )
-- on conflict (username) do nothing;
