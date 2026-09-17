export const INSTAGRAM_PURCHASE_URL = "https://instagram.com/realdealkickzsc";

export function InstagramPurchaseNotice() {
  return (
    <p className="rounded border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
      Payments are unavailable on this website. Message{" "}
      <a
        href={INSTAGRAM_PURCHASE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-red-400 underline underline-offset-4 hover:text-red-300"
      >
        @realdealkickzsc on Instagram
      </a>{" "}
      to purchase.
    </p>
  );
}
