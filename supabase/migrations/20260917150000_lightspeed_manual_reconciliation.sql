begin;

create unique index if not exists lightspeed_sync_runs_one_running_per_tenant
  on public.lightspeed_sync_runs (tenant_id)
  where status = 'running';

commit;
