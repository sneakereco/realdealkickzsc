-- Run with psql -v ON_ERROR_STOP=1 after applying the migration. Leaves no test data.
begin;
do $$
declare
  tenant uuid := gen_random_uuid();
  other_tenant uuid := gen_random_uuid();
  new_product uuid := gen_random_uuid();
  used_product uuid := gen_random_uuid();
  new_variant uuid := gen_random_uuid();
  used_variant uuid := gen_random_uuid();
  moves jsonb;
begin
  insert into public.tenants(id, name) values (tenant, 'Lightspeed transaction test');
  insert into public.products(id, tenant_id, name, brand, category, condition)
    values (new_product, tenant, 'Test new', 'Test', 'sneakers', 'new'),
           (used_product, tenant, 'Test used', 'Test', 'sneakers', 'used');
  insert into public.product_variants(id, tenant_id, product_id, sku, size_label, sale_price_cents, stock)
    values (new_variant, tenant, new_product, 'test-new', '10', 100, 1),
           (used_variant, tenant, used_product, 'test-used', '10', 100, 1);
  insert into public.lightspeed_product_links(tenant_id, product_id, variant_id, external_sku, lightspeed_family_id)
    values (tenant, new_product, new_variant, 'test-new', 'test-family'),
           (tenant, used_product, used_variant, 'test-used', 'test-family');
  moves := jsonb_build_array(
    jsonb_build_object('variant_id', new_variant, 'product_id', used_product, 'size_label', '10'),
    jsonb_build_object('variant_id', used_variant, 'product_id', new_product, 'size_label', '10')
  );
  perform public.move_lightspeed_variants(tenant, 'test-family', moves);
  if not exists(select 1 from public.product_variants where id = new_variant and product_id = used_product and size_label = '10')
    or not exists(select 1 from public.product_variants where id = used_variant and product_id = new_product and size_label = '10')
    or not exists(select 1 from public.lightspeed_product_links where variant_id = new_variant and product_id = used_product)
  then raise exception 'swap did not preserve identities'; end if;
  begin
    perform public.move_lightspeed_variants(tenant, 'test-family', jsonb_build_array(
      jsonb_build_object('variant_id', new_variant, 'product_id', new_product, 'size_label', '10')));
    raise exception 'conflicting move unexpectedly succeeded';
  exception when unique_violation then null;
  end;
  if not exists(select 1 from public.product_variants where id = new_variant and product_id = used_product and size_label = '10')
    then raise exception 'failed move did not roll back'; end if;
  begin
    perform public.move_lightspeed_variants(other_tenant, 'test-family', moves);
    raise exception 'wrong tenant unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm <> 'lightspeed_variant_move_not_found' then raise; end if;
  end;
end;
$$;
rollback;
