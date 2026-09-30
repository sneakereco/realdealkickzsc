-- Move existing provider variants together so condition/size swaps keep identity.
create or replace function public.move_lightspeed_variants(
  p_tenant_id uuid, p_family_id text, p_moves jsonb
) returns void
language plpgsql security invoker set search_path = public
as $$
declare
  move record;
begin
  if jsonb_typeof(p_moves) is distinct from 'array' then
    raise exception 'lightspeed_variant_moves_invalid';
  end if;
  -- Lock and validate every source before making changes. RLS still applies.
  for move in select * from jsonb_to_recordset(p_moves)
    as x(variant_id uuid, product_id uuid, size_label text)
  loop
    perform 1 from product_variants v
      join lightspeed_product_links l on l.variant_id = v.id
      join products p on p.id = move.product_id
      where v.id = move.variant_id and v.tenant_id = p_tenant_id
        and l.tenant_id = p_tenant_id and l.lightspeed_family_id = p_family_id
        and p.tenant_id = p_tenant_id
        and length(trim(move.size_label)) > 0
      for update of v;
    if not found then raise exception 'lightspeed_variant_move_not_found'; end if;
  end loop;
  -- Temporary sizes exist only within this transaction, never in API responses.
  update product_variants v set size_label = '__lightspeed_move_' || gen_random_uuid()::text
    from jsonb_to_recordset(p_moves) as x(variant_id uuid, product_id uuid, size_label text)
    where v.id = x.variant_id and v.tenant_id = p_tenant_id;
  update product_variants v set product_id = x.product_id, size_label = x.size_label
    from jsonb_to_recordset(p_moves) as x(variant_id uuid, product_id uuid, size_label text)
    where v.id = x.variant_id and v.tenant_id = p_tenant_id;
  update lightspeed_product_links l set product_id = x.product_id, updated_at = now()
    from jsonb_to_recordset(p_moves) as x(variant_id uuid, product_id uuid, size_label text)
    where l.variant_id = x.variant_id and l.tenant_id = p_tenant_id
      and l.lightspeed_family_id = p_family_id;
end;
$$;
revoke all on function public.move_lightspeed_variants(uuid, text, jsonb) from public, anon;
grant execute on function public.move_lightspeed_variants(uuid, text, jsonb) to authenticated, service_role;
