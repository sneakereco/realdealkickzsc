import type { ProductWithDetails } from "@/types/domain/product";
import { createSizeMatcher, type SizeFilters } from "@/lib/size-filters";

export function getMatchingAvailableVariants(
  product: ProductWithDetails,
  filters: SizeFilters = {},
) {
  const matches = createSizeMatcher(filters);
  return product.variants.filter(
    (v) => v.stock > 0 && matches(product.size_type, v.size_label),
  );
}

export function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatPriceRange(variants: { sale_price_cents: number }[]) {
  if (!variants.length) return "Unavailable";
  const prices = variants.map((v) => v.sale_price_cents);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatPrice(min) : `${formatPrice(min)}–${formatPrice(max)}`;
}
