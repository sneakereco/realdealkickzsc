// app/cart/page.tsx

"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";

import { useCart } from "@/components/cart/CartProvider";
import { InstagramPurchaseNotice } from "@/components/purchase/InstagramPurchaseNotice";

export default function CartPage() {
  const { items, removeItem, updateQuantity, total } = useCart();

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 sm:py-20 text-center">
        <ShoppingCart className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 mx-auto mb-5 sm:mb-6" />
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">
          Your cart is empty
        </h1>
        <p className="text-sm sm:text-base text-gray-400 mb-6 sm:mb-8">
          Add some items to get started
        </p>
        <Link
          href="/store"
          className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold px-6 sm:px-8 py-3 rounded transition text-sm sm:text-base"
        >
          Shop Now
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      <h1 className="text-2xl sm:text-4xl font-bold text-white mb-6 sm:mb-8">
        Shopping Cart
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const canIncrease =
              typeof item.maxStock === "number" ? item.quantity < item.maxStock : true;
            return (
              <div
                key={`${item.productId}-${item.variantId}`}
                className="bg-zinc-900 border border-zinc-800/70 rounded p-4 flex flex-col sm:flex-row sm:items-start gap-4"
              >
                <Link
                  href={`/store/${item.productId}`}
                  className="flex gap-4 flex-1 min-w-0"
                >
                  <div className="w-20 h-20 sm:w-24 sm:h-24 relative flex-shrink-0">
                    <Image
                      src={item.imageUrl}
                      alt={item.titleDisplay}
                      fill
                      className="object-cover rounded"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold text-base sm:text-lg truncate">
                      {item.titleDisplay}
                    </h3>
                    <p className="text-gray-400 text-xs sm:text-sm">
                      Size: {item.sizeLabel}
                    </p>
                    <p className="text-white font-bold text-sm sm:text-base mt-2">
                      ${(item.priceCents / 100).toFixed(2)}
                    </p>
                  </div>
                </Link>

                <div className="mt-2 sm:mt-0 flex w-full sm:w-auto items-center justify-between sm:flex-col sm:items-end sm:justify-between gap-3 sm:gap-4">
                  <button
                    onClick={() => removeItem(item.productId, item.variantId)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>

                  <div className="flex items-center gap-2 sm:gap-3">
                    <button
                      onClick={() =>
                        updateQuantity(item.productId, item.variantId, item.quantity - 1)
                      }
                      className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-zinc-800 rounded hover:bg-zinc-700"
                    >
                      <Minus className="w-4 h-4 text-white" />
                    </button>
                    <span className="text-white font-semibold text-sm sm:text-base w-8 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateQuantity(item.productId, item.variantId, item.quantity + 1)
                      }
                      disabled={!canIncrease}
                      className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded ${
                        canIncrease
                          ? "bg-zinc-800 hover:bg-zinc-700"
                          : "bg-zinc-900 opacity-50 cursor-not-allowed"
                      }`}
                    >
                      <Plus className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-zinc-900 border border-zinc-800/70 rounded p-5 sm:p-6 lg:sticky lg:top-20">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-5 sm:mb-6">
              Cart Summary
            </h2>

            <div className="space-y-3 mb-6 text-sm sm:text-base">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal</span>
                <span>${(total / 100).toFixed(2)}</span>
              </div>
              <div className="border-t border-zinc-800/70 pt-3">
                <div className="flex justify-between text-lg sm:text-xl font-bold text-white">
                  <span>Cart subtotal</span>
                  <span>${(total / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <InstagramPurchaseNotice />
            </div>

            <Link
              href="/store"
              className="block text-center text-gray-400 hover:text-white text-sm"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
