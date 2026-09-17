// app/api/store/filters/route.ts
// OPTIMIZED VERSION - Aggressive caching for filter data

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StorefrontService } from "@/modules/catalog/storefront";
import { getRequestIdFromHeaders } from "@/lib/http/request-id";
import { logError } from "@/lib/utils/log";

// OPTIMIZATION 1: Cache filter data for 5 minutes
// Filters don't change often, so we can cache aggressively
export const revalidate = 300;
export const dynamic = "force-static";

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const supabase = await createSupabaseServerClient();
    const service = new StorefrontService(supabase);

    // OPTIMIZATION 2: You could optionally parse filter params here
    // and only return relevant filters based on current selection
    // This reduces the payload size significantly
    const searchParams = request.nextUrl.searchParams;
    const categoryParam = searchParams.getAll("category").filter(Boolean);
    const brandParam = searchParams.getAll("brand").filter(Boolean);

    // If specific filters are applied, only return relevant options
    const filters =
      categoryParam.length > 0 || brandParam.length > 0
        ? {
            category: categoryParam,
            brand: brandParam,
          }
        : undefined;

    const data = await service.listFilters({ filters });

    // OPTIMIZATION 3: Aggressive caching for filter data
    return NextResponse.json(data, {
      headers: {
        // Cache for 5 minutes, serve stale for 10 minutes while revalidating
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "CDN-Cache-Control": "public, s-maxage=300",
        "Vercel-CDN-Cache-Control": "public, s-maxage=300",
      },
    });
  } catch (error) {
    logError(error, {
      layer: "api",
      requestId,
      route: "/api/store/filters",
    });
    return NextResponse.json(
      { error: "Failed to fetch filters", requestId },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
