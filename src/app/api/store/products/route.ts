// app/api/store/products/route.ts

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import { StorefrontService } from "@/modules/catalog/storefront";
import { storeProductsQuerySchema } from "@/lib/validation/storefront";
import { getRequestIdFromHeaders } from "@/lib/http/request-id";
import { logError } from "@/lib/utils/log";
import { isAdminRole, isProfileRole } from "@/config/constants/roles";

// OPTIMIZATION: Cache public catalog queries (5 minutes)
// Note: Admin queries (out_of_stock, all) remain uncached
export const revalidate = 300;

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);
  const searchParams = request.nextUrl.searchParams;

  const qParam = searchParams.get("q");
  const sortParam = searchParams.get("sort");
  const stockStatusParam = searchParams.get("stockStatus");

  let stockStatus: "in_stock" | "out_of_stock" | "all" = "in_stock";

  if (stockStatusParam === "out_of_stock" || stockStatusParam === "all") {
    const session = await getServerSession();
    const role = isProfileRole(session?.role) ? session?.role : "customer";
    if (role && isAdminRole(role)) {
      stockStatus = stockStatusParam;
    }
  }

  const parsed = storeProductsQuerySchema.safeParse({
    q: qParam && qParam.trim().length > 0 ? qParam : undefined,
    category: searchParams.getAll("category").filter(Boolean),
    brand: searchParams.getAll("brand").filter(Boolean),
    model: searchParams.getAll("model").filter(Boolean),
    sizeShoe: searchParams.getAll("sizeShoe").filter(Boolean),
    sizeClothing: searchParams.getAll("sizeClothing").filter(Boolean),
    condition: searchParams.getAll("condition").filter(Boolean),
    sort: sortParam && sortParam.trim().length > 0 ? sortParam : "newest",
    page: Number.parseInt(searchParams.get("page") ?? "1", 10),
    limit: Number.parseInt(searchParams.get("limit") ?? "20", 10),
    stockStatus,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", issues: parsed.error.format(), requestId },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const service = new StorefrontService(supabase);

    const result = await service.listProducts(parsed.data);

    // OPTIMIZATION: Only cache public catalog queries (not admin out-of-stock queries)
    const isAdminQuery = stockStatus !== "in_stock";

    return NextResponse.json(result, {
      headers: isAdminQuery
        ? { "Cache-Control": "no-store" } // Admin queries stay uncached
        : {
            // Public catalog: cache for 5 minutes
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
            "CDN-Cache-Control": "public, s-maxage=300",
            "Vercel-CDN-Cache-Control": "public, s-maxage=300",
          },
    });
  } catch (error) {
    logError(error, {
      layer: "api",
      requestId,
      route: "/api/store/products",
    });
    return NextResponse.json(
      { error: "Failed to fetch products", requestId },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
