begin;

alter table public.lightspeed_webhook_events
  add column if not exists resource_id text,
  add column if not exists resource_version bigint,
  add column if not exists state text not null default 'pending',
  add column if not exists attempts integer not null default 0,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists lease_until timestamptz,
  add column if not exists outcome jsonb,
  add column if not exists last_error text;

alter table public.lightspeed_webhook_events
  drop constraint if exists lightspeed_webhook_events_state_check;

alter table public.lightspeed_webhook_events
  add constraint lightspeed_webhook_events_state_check
  check (state in ('pending', 'processing', 'succeeded', 'retry_wait', 'needs_attention'));

create unique index if not exists lightspeed_webhook_events_tenant_event_key
  on public.lightspeed_webhook_events (tenant_id, event_id);

create index if not exists lightspeed_webhook_events_retry_due
  on public.lightspeed_webhook_events (next_attempt_at, created_at)
  where state in ('pending', 'retry_wait');

commit;
