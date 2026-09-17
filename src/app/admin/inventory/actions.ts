// app/admin/inventory/actions.ts
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { ensureTenantId } from "@/lib/auth/tenant";
import { ProductService } from "@/services/product-service";
import type { Category, Condition } from "@/types/domain/product";

type StockStatus = "in_stock" | "out_of_stock" | "archived" | "all";

interface InventoryFilters {
  q?: string;
  category?: Category | "all";
  condition?: Condition | "all";
  stockStatus?: StockStatus;
  page?: number;
  limit?: number;
}

export async function getInventoryProducts(filters: InventoryFilters = {}) {
  const session = await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const tenantId = await ensureTenantId(session, supabase);

  const service = new ProductService(supabase);

  const {
    q,
    category,
    condition,
    stockStatus = "in_stock",
    page = 1,
    limit = 100,
  } = filters;

  const result = await service.listProducts({
    q,
    category: category && category !== "all" ? [category] : undefined,
    condition: condition && condition !== "all" ? [condition] : undefined,
    limit,
    page,
    includeOutOfStock: true, // Admin needs to see all products
    stockStatus,
    tenantId,
    searchMode: "inventory",
  });

  return result;
}
