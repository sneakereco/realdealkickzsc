import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/auth/session";
import { ensureTenantId } from "@/lib/auth/tenant";
import { getRequestIdFromHeaders } from "@/lib/http/request-id";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logError } from "@/lib/utils/log";
import { adminProductsQuerySchema } from "@/lib/validation/product";
import { ProductService } from "@/services/product-service";

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const session = await requireAdminApi();
    const supabase = await createSupabaseServerClient();
    const tenantId = await ensureTenantId(session, supabase);
    const { searchParams } = new URL(request.url);
    const parsedQuery = adminProductsQuerySchema.safeParse({
      q: searchParams.get("q") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      category: searchParams.getAll("category").filter(Boolean),
      condition: searchParams.getAll("condition").filter(Boolean),
      includeOutOfStock: searchParams.get("includeOutOfStock") ?? undefined,
      stockStatus: searchParams.get("stockStatus") ?? undefined,
      searchMode: searchParams.get("searchMode") ?? undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          issues: parsedQuery.error.format(),
          requestId,
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { category, condition, searchMode, ...filters } = parsedQuery.data;
    const result = await new ProductService(supabase).listProducts({
      ...filters,
      category: category?.length ? category : undefined,
      condition: condition?.length ? condition : undefined,
      searchMode: searchMode ?? "inventory",
      tenantId,
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    logError(error, {
      layer: "api",
      requestId,
      route: "/api/admin/products (GET)",
    });
    return NextResponse.json(
      { error: "Failed to load products", requestId },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
