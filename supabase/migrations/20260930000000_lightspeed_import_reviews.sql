create table public.lightspeed_import_reviews (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  family_id text not null,
  corrections jsonb not null default '{}',
  source_payload jsonb,
  error text,
  resolved boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, family_id),
  check (jsonb_typeof(corrections) = 'object')
);
alter table public.lightspeed_import_reviews enable row level security;
create policy "Tenant admins manage import reviews" on public.lightspeed_import_reviews
  for all to authenticated
  using (public.is_admin_for_tenant(tenant_id))
  with check (public.is_admin_for_tenant(tenant_id));
grant select, insert, update, delete on public.lightspeed_import_reviews to authenticated, service_role;

-- Seed the current unresolved queue without changing any catalog records.
insert into public.lightspeed_import_reviews(tenant_id, family_id, error)
select i.tenant_id, i.entity_key, max(i.failure_reason)
from public.lightspeed_sync_run_items i
join (select distinct on (tenant_id) id from public.lightspeed_sync_runs
      order by tenant_id, created_at desc) r on r.id = i.sync_run_id
where i.apply_status = 'failed'
group by i.tenant_id, i.entity_key
on conflict do nothing;
