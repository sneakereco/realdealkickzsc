// app/api/store/products/[id]/route.ts
// OPTIMIZED VERSION - Strong caching for individual products

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerSession } from "@/lib/auth/session";
import { StorefrontService } from "@/modules/catalog/storefront";
import { getRequestIdFromHeaders } from "@/lib/http/request-id";
import { logError } from "@/lib/utils/log";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

// OPTIMIZATION 1: Product details change infrequently, cache for 5 minutes
export const revalidate = 300;
export const dynamic = "force-static";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestIdFromHeaders(request.headers);
  const { id } = await params;
  const parsed = paramsSchema.safeParse({ id });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid params", issues: parsed.error.format(), requestId },
      {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const service = new StorefrontService(supabase);
    const includeOutOfStockParam = request.nextUrl.searchParams.get("includeOutOfStock");
    const includeOutOfStockRequested =
      includeOutOfStockParam === "1" || includeOutOfStockParam === "true";
    let includeOutOfStock = false;
    if (includeOutOfStockRequested) {
      const session = await getServerSession();
      includeOutOfStock = session?.role === "admin";
    }
    const product = await service.getProductById(parsed.data.id, { includeOutOfStock });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found", requestId },
        {
          status: 404,
          // Cache 404s for a short time to prevent hammering
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
          },
        },
      );
    }

    // OPTIMIZATION 2: Cache product details aggressively
    // Products don't change often (price/stock updates are less frequent)
    return NextResponse.json(product, {
      headers: {
        // Cache for 5 minutes, serve stale for 10 minutes while revalidating
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "CDN-Cache-Control": "public, s-maxage=300",
        "Vercel-CDN-Cache-Control": "public, s-maxage=300",
        // Add ETag for better cache validation
        ETag: `"${product.id}-${product.updated_at || product.created_at}"`,
      },
    });
  } catch (error) {
    logError(error, {
      layer: "api",
      requestId,
      route: "/api/store/products/:id",
    });
    return NextResponse.json(
      { error: "Failed to fetch product", requestId },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
