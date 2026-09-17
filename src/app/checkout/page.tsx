import Link from "next/link";

import { InstagramPurchaseNotice } from "@/components/purchase/InstagramPurchaseNotice";

export default function CheckoutPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="text-3xl font-bold text-white">Online checkout is unavailable</h1>
      <div className="mt-6">
        <InstagramPurchaseNotice />
      </div>
      <Link
        href="/cart"
        className="mt-6 inline-block text-sm text-zinc-400 underline underline-offset-4 hover:text-white"
      >
        Return to your cart
      </Link>
    </main>
  );
}
