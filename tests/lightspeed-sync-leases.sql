-- Run against a migrated local database; all rows are rolled back.
begin;
do $$
declare
  tenant uuid := gen_random_uuid();
  other_tenant uuid := gen_random_uuid();
  run_id uuid := gen_random_uuid();
  claimed jsonb;
  saved jsonb;
begin
  insert into public.tenants(id, name) values (tenant, 'Sync lease test'), (other_tenant, 'Other tenant');
  insert into public.lightspeed_sync_runs(id, tenant_id, source_of_truth, status, checkpoint)
    values(run_id, tenant, 'lightspeed', 'running', '{"phase":"listing"}');
  claimed := public.claim_lightspeed_sync(run_id);
  if claimed is null then raise exception 'claim failed'; end if;
  if public.claim_lightspeed_sync(run_id) is not null then raise exception 'double worker'; end if;
  if public.cancel_lightspeed_sync(run_id, other_tenant) is not null then raise exception 'cross tenant cancellation'; end if;
  perform public.cancel_lightspeed_sync(run_id, tenant);
  if (select status from public.lightspeed_sync_runs where id=run_id) <> 'running' then
    raise exception 'cancel released an active worker early';
  end if;
  saved := public.save_lightspeed_sync(run_id, (claimed->>'lease_token')::uuid, '{"phase":"applying","index":1}', '{"updated":1}', 'running', false);
  if saved->>'status' <> 'cancelled' or saved->'summary'->>'updated' <> '1' then raise exception 'cancel lost work'; end if;
  if public.save_lightspeed_sync(run_id, (claimed->>'lease_token')::uuid, '{}', '{}', 'success', true) is not null then
    raise exception 'late worker resurrected cancelled run';
  end if;
  update public.lightspeed_sync_runs set status='running', cancel_requested_at=null, completed_at=null,
    lease_token=null, lease_until=null, checkpoint='{}' where id=run_id;
  claimed := public.claim_lightspeed_sync(run_id);
  update public.lightspeed_sync_runs set lease_until=now()-interval '1 second' where id=run_id;
  saved := public.claim_lightspeed_sync(run_id);
  if saved is null or saved->>'lease_token'=claimed->>'lease_token' then raise exception 'lease not recovered'; end if;
  if public.save_lightspeed_sync(run_id, (claimed->>'lease_token')::uuid, '{}', '{}', 'success', true) is not null then
    raise exception 'old lease overwrote recovered run';
  end if;
  update public.lightspeed_sync_runs set lease_until=now()-interval '1 second', worker_attempts=3 where id=run_id;
  perform public.claim_lightspeed_sync(run_id);
  if (select status from public.lightspeed_sync_runs where id=run_id) <> 'failed' then raise exception 'abandoned run never failed'; end if;
  if has_function_privilege('authenticated', 'public.claim_lightspeed_sync(uuid)', 'EXECUTE') then raise exception 'client can claim jobs'; end if;
end $$;
rollback;
