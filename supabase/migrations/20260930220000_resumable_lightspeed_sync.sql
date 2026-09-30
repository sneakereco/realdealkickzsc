begin;

alter table public.lightspeed_sync_runs
  add column checkpoint jsonb,
  add column lease_token uuid,
  add column lease_until timestamptz,
  add column cancel_requested_at timestamptz,
  add column worker_attempts integer not null default 0;

create function public.recover_legacy_lightspeed_sync(p_tenant_id uuid default null)
returns void language sql security definer set search_path = public as $$
  update public.lightspeed_sync_runs
  set status='failed', completed_at=now(),
      summary=summary || jsonb_build_object('error', 'The previous sync stopped without completing. Start a new sync to retry.',
        'progress', coalesce(summary->'progress', '{}'::jsonb) || jsonb_build_object('phase','failed','updated_at',now()))
  where status='running' and checkpoint is null
    and (p_tenant_id is null or tenant_id=p_tenant_id)
    and coalesce((summary#>>'{progress,updated_at}')::timestamptz,created_at) < now()-interval '6 minutes';
$$;

create function public.claim_lightspeed_sync(p_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.lightspeed_sync_runs;
begin
  select * into r from public.lightspeed_sync_runs where id=p_run_id for update;
  if not found or r.status <> 'running' or r.checkpoint is null or r.lease_until > now() then return null; end if;
  if r.cancel_requested_at is not null or r.worker_attempts >= 3 then
    update public.lightspeed_sync_runs set
      status=case when r.cancel_requested_at is not null then 'cancelled' else 'failed' end,
      completed_at=now(), lease_until=null, lease_token=null,
      summary=r.summary || jsonb_build_object('error',case when r.cancel_requested_at is not null
        then 'Sync cancelled. Changes already saved were kept.'
        else 'Sync stopped after three interrupted worker attempts. Check Vercel runtime logs using this run ID.' end,
        'progress',coalesce(r.summary->'progress','{}'::jsonb) || jsonb_build_object('phase',case when r.cancel_requested_at is not null then 'cancelled' else 'failed' end,'updated_at',now()))
      where id=p_run_id;
    return null;
  end if;
  -- Longer than the 300-second platform limit: expired workers cannot overlap replacements.
  update public.lightspeed_sync_runs set lease_token=gen_random_uuid(), lease_until=now()+interval '6 minutes',
    worker_attempts=worker_attempts+1 where id=p_run_id returning * into r;
  return to_jsonb(r);
end $$;

create function public.save_lightspeed_sync(p_run_id uuid, p_token uuid, p_checkpoint jsonb,
  p_summary jsonb, p_status text, p_release boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.lightspeed_sync_runs; final_status text;
begin
  if p_status not in ('running','success','partial_failure','failed') then raise exception 'invalid sync status'; end if;
  select * into r from public.lightspeed_sync_runs where id=p_run_id for update;
  if not found or r.status <> 'running' or r.lease_token is distinct from p_token or r.lease_until <= now() then return null; end if;
  final_status := case when r.cancel_requested_at is not null then 'cancelled' else p_status end;
  if final_status='cancelled' then
    p_summary := p_summary || jsonb_build_object('error','Sync cancelled. Changes already saved were kept.',
      'progress',coalesce(p_summary->'progress','{}'::jsonb) || jsonb_build_object('phase','cancelled','updated_at',now()));
  end if;
  update public.lightspeed_sync_runs set checkpoint=p_checkpoint, summary=p_summary, status=final_status,
    completed_at=case when final_status <> 'running' then now() else null end,
    lease_token=case when p_release or final_status <> 'running' then null else lease_token end,
    lease_until=case when p_release or final_status <> 'running' then null else lease_until end,
    worker_attempts=0
  where id=p_run_id returning * into r;
  return to_jsonb(r);
end $$;

create function public.cancel_lightspeed_sync(p_run_id uuid, p_tenant_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.lightspeed_sync_runs;
begin
  select * into r from public.lightspeed_sync_runs where id=p_run_id and tenant_id=p_tenant_id for update;
  if not found then return null; end if;
  if r.status <> 'running' then return to_jsonb(r); end if;
  update public.lightspeed_sync_runs set cancel_requested_at=coalesce(cancel_requested_at,now()) where id=p_run_id;
  if r.checkpoint is not null and (r.lease_until is null or r.lease_until <= now()) then
    perform public.claim_lightspeed_sync(p_run_id);
  end if;
  select * into r from public.lightspeed_sync_runs where id=p_run_id;
  return to_jsonb(r);
end $$;

create function public.enqueue_lightspeed_sync(p_tenant_id uuid, p_user_id uuid, p_checkpoint jsonb,
  p_summary jsonb, p_event_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.lightspeed_sync_runs;
begin
  if p_event_id is not null then
    perform 1 from public.lightspeed_webhook_events where id=p_event_id and tenant_id=p_tenant_id for update;
    if not found then raise exception 'webhook tenant mismatch'; end if;
  end if;
  insert into public.lightspeed_sync_runs(tenant_id,started_by,source_of_truth,status,checkpoint,summary)
    values(p_tenant_id,p_user_id,'lightspeed','running',p_checkpoint,p_summary) returning * into r;
  if p_event_id is not null then
    update public.lightspeed_webhook_events set state='processing', lease_until=null,
      outcome=jsonb_build_object('run_id',r.id), last_error=null where id=p_event_id;
  end if;
  return to_jsonb(r);
end $$;

revoke all on function public.recover_legacy_lightspeed_sync(uuid), public.claim_lightspeed_sync(uuid),
  public.save_lightspeed_sync(uuid,uuid,jsonb,jsonb,text,boolean), public.cancel_lightspeed_sync(uuid,uuid),
  public.enqueue_lightspeed_sync(uuid,uuid,jsonb,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.recover_legacy_lightspeed_sync(uuid), public.claim_lightspeed_sync(uuid),
  public.save_lightspeed_sync(uuid,uuid,jsonb,jsonb,text,boolean), public.cancel_lightspeed_sync(uuid,uuid),
  public.enqueue_lightspeed_sync(uuid,uuid,jsonb,jsonb,uuid) to service_role;

commit;
