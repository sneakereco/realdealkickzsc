// src/components/store/ProductCard.tsx
// OPTIMIZED VERSION - Better image loading and performance

import Link from "next/link";
import Image from "next/image";

import type { ProductWithDetails } from "@/types/domain/product";
import { hasSizeFilters, type SizeFilters } from "@/lib/size-filters";
import {
  formatPrice,
  formatPriceRange,
  getMatchingAvailableVariants,
} from "@/lib/store-pricing";

interface ProductCardProps {
  product: ProductWithDetails;
  storeHref?: string;
  priority?: boolean; // For above-the-fold images
  sizeFilters?: SizeFilters;
}

export function ProductCard({
  product,
  storeHref,
  priority = false,
  sizeFilters = {},
}: ProductCardProps) {
  const primaryImage = product.images.find((img) => img.is_primary) || product.images[0];
  const variants = getMatchingAvailableVariants(product, sizeFilters);
  if (!variants.length) return null;
  const filtered = hasSizeFilters(sizeFilters);
  const priceDisplay = formatPriceRange(variants);
  const isRange = new Set(variants.map((v) => v.sale_price_cents)).size > 1;
  const sizes = [...new Set(variants.map((v) => v.size_label))];
  const sizeDisplay =
    sizes.length === 1
      ? sizes[0] === "N/A"
        ? "No size"
        : `Size ${sizes[0]}${filtered ? " available" : ""}`
      : filtered
        ? sizes.length === 2
          ? `Sizes ${sizes.join(", ")}`
          : `${sizes.length} matching sizes`
        : `${sizes.length} sizes available`;
  const breakdown =
    filtered && variants.length === 2 && sizes.length === 2 && isRange
      ? variants.map((v) => `${v.size_label} · ${formatPrice(v.sale_price_cents)}`)
      : [];

  const conditionBadge =
    product.condition === "new" ? (
      <span className="bg-green-600 text-white text-[10px] px-2 py-0.5 rounded-full border border-zinc-900 shadow-sm">
        NEW
      </span>
    ) : product.condition === "used" ? (
      <span className="bg-amber-500 text-black text-[10px] px-2 py-0.5 rounded-full border border-zinc-900 shadow-sm">
        PRE-OWNED
      </span>
    ) : null;

  const params = new URLSearchParams();
  if (storeHref) params.set("from", storeHref);
  sizeFilters.sizeShoe?.forEach((size) => params.append("sizeShoe", size));
  sizeFilters.sizeClothing?.forEach((size) => params.append("sizeClothing", size));
  const productHref = `/store/${product.id}${params.size ? `?${params}` : ""}`;

  return (
    <Link
      href={productHref}
      className="group block h-full min-w-0"
      data-testid="product-card"
      data-product-id={product.id}
      // OPTIMIZATION 1: Add prefetch only for visible cards
      prefetch={priority}
    >
      <div className="bg-zinc-900 border border-zinc-800/70 rounded overflow-hidden hover:border-zinc-600/70 transition flex h-full flex-col">
        <div className="aspect-square relative bg-zinc-800">
          {primaryImage && (
            <Image
              src={primaryImage.url}
              alt={product.name}
              fill
              sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
              // OPTIMIZATION 2: Priority for first 8 cards, lazy for rest
              loading={priority ? "eager" : "lazy"}
              priority={priority}
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              // OPTIMIZATION 3: Lower quality for thumbnails
              quality={75}
              // OPTIMIZATION 4: Use placeholder for better LCP
              placeholder="blur"
              blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/+F9PQAI8wNPvd7POQAAAABJRU5ErkJggg=="
            />
          )}

          {conditionBadge && (
            <div className="absolute top-2 right-2 z-10">{conditionBadge}</div>
          )}
        </div>

        <div className="p-3 flex flex-col flex-1">
          {/* Title */}
          <div className="flex items-start justify-between gap-2 min-h-[1.5rem]">
            <h3 className="text-white font-bold text-sm truncate flex-1">
              {product.name}
            </h3>
          </div>

          {/* Size under title */}
          <p className="mt-1 text-gray-400 text-xs break-words">{sizeDisplay}</p>

          {/* Price at bottom, bigger */}
          <div className="mt-auto pt-3">
            <span className="text-white font-extrabold text-base sm:text-lg tabular-nums break-words">
              {priceDisplay}
            </span>
            {isRange && (
              <p className="mt-1 text-gray-400 text-xs">
                {filtered ? "Selected sizes" : "Price varies by size"}
              </p>
            )}
            {breakdown.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-300">
                {breakdown.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
