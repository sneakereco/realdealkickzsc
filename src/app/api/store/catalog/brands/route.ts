// app/api/store/catalog/brands/route.ts

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StorefrontService } from "@/modules/catalog/storefront";
import { storeBrandQuerySchema } from "@/lib/validation/storefront";
import { getRequestIdFromHeaders } from "@/lib/http/request-id";
import { logError } from "@/lib/utils/log";

// OPTIMIZATION: Brands are static data, cache aggressively
export const revalidate = 1800; // 30 minutes
export const dynamic = "force-static";

export async function GET(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);
  const searchParams = request.nextUrl.searchParams;
  const groupKeyParam = searchParams.get("groupKey");
  const parsed = storeBrandQuerySchema.safeParse({
    groupKey: groupKeyParam && groupKeyParam.trim().length > 0 ? groupKeyParam : null,
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
    const brands = await service.listBrandsByGroupKey(parsed.data.groupKey ?? null);

    return NextResponse.json(
      { brands },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
          "CDN-Cache-Control": "public, s-maxage=1800",
          "Vercel-CDN-Cache-Control": "public, s-maxage=1800",
        },
      },
    );
  } catch (error) {
    logError(error, {
      layer: "api",
      requestId,
      route: "/api/store/catalog/brands",
    });
    return NextResponse.json(
      { error: "Failed to fetch brands", requestId },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
