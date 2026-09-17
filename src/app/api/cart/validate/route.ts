import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProductRepository } from "@/modules/catalog/product-repository";
import { cartValidateSchema } from "@/lib/validation/cart";
import { getRequestIdFromHeaders } from "@/lib/http/request-id";
import { logError } from "@/lib/utils/log";
import type { CartItem } from "@/types/domain/cart";

const PLACEHOLDER_IMAGE = "/placeholder.png";

export async function POST(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const body = await request.json().catch(() => null);
    const parsed = cartValidateSchema.safeParse(body ?? {});

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.format(), requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const items = parsed.data.items ?? [];
    if (items.length === 0) {
      return NextResponse.json(
        { items: [], removed: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const supabase = await createSupabaseServerClient();
    const repo = new ProductRepository(supabase);
    const variantIds = [...new Set(items.map((item) => item.variantId))];
    const variants = await repo.getVariantsForCart(variantIds);
    const variantMap = new Map(variants.map((variant) => [variant.variantId, variant]));

    const nextItems: CartItem[] = [];
    const removed: Array<{ productId: string; variantId: string; reason: string }> = [];

    for (const item of items) {
      const variant = variantMap.get(item.variantId);
      if (!variant || variant.productId !== item.productId) {
        removed.push({
          productId: item.productId,
          variantId: item.variantId,
          reason: "not_found",
        });
        continue;
      }

      if (!variant.isActive || variant.isOutOfStock || variant.stock <= 0) {
        removed.push({
          productId: item.productId,
          variantId: item.variantId,
          reason: "out_of_stock",
        });
        continue;
      }

      const maxStock = Math.max(0, variant.stock);
      const quantity = Math.min(item.quantity, maxStock);

      if (quantity <= 0) {
        removed.push({
          productId: item.productId,
          variantId: item.variantId,
          reason: "insufficient_stock",
        });
        continue;
      }

      nextItems.push({
        productId: variant.productId,
        variantId: variant.variantId,
        sizeLabel: variant.sizeLabel,
        brand: variant.brand,
        name: variant.name,
        titleDisplay: variant.titleDisplay || `${variant.brand} ${variant.name}`.trim(),
        priceCents: variant.priceCents,
        imageUrl: variant.imageUrl ?? PLACEHOLDER_IMAGE,
        quantity,
        maxStock,
      });
    }

    return NextResponse.json(
      { items: nextItems, removed },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    logError(error, {
      layer: "api",
      requestId,
      route: "/api/cart/validate",
    });

    return NextResponse.json(
      { error: "Failed to validate cart", requestId },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
