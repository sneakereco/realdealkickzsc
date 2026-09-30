"use client";

import { useState } from "react";
import Image from "next/image";
import type { ReviewFamily, FamilyCorrections } from "./reconciliation";

const inputClass =
  "block w-full rounded border border-zinc-600 bg-black px-3 py-2 text-white";
type Item = { id: string; name: string; error: string | null };
export function LightspeedReviewQueue({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [family, setFamily] = useState<ReviewFamily | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function list(nextPage = page) {
    const response = await fetch(`/api/admin/lightspeed/reviews?page=${nextPage}`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error);
    setItems(payload.items);
    setTotal(payload.total);
    setPage(nextPage);
  }
  async function show(id?: string) {
    setBusy(true);
    setMessage("");
    try {
      setOpen(true);
      if (!id) {
        await list(0);
        return;
      }
      const response = await fetch(
        `/api/admin/lightspeed/reviews?familyId=${encodeURIComponent(id)}`,
        { cache: "no-store" },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setFamily(payload.family);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load review.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!family) return;
    setBusy(true);
    setMessage("");
    const corrections: FamilyCorrections = { exclude: family.exclude };
    if (family.category)
      corrections.category = family.category as FamilyCorrections["category"];
    corrections.variants = Object.fromEntries(
      family.variants.map((v) => [
        v.id,
        {
          ...(v.condition ? { condition: v.condition as "new" | "used" } : {}),
          ...(v.size.trim() ? { size: v.size.trim() } : {}),
        },
      ]),
    );
    try {
      const response = await fetch("/api/admin/lightspeed/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyId: family.id, corrections }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage([payload.message, payload.error].filter(Boolean).join(" "));
        return;
      }
      setMessage(payload.message);
      setFamily(null);
      await list(0);
    } catch {
      setMessage("Could not confirm the save. Reload this product before retrying.");
    } finally {
      setBusy(false);
    }
  }
  function editVariant(id: string, field: "condition" | "size", value: string) {
    setFamily((current) =>
      current
        ? {
            ...current,
            variants: current.variants.map((v) =>
              v.id === id ? { ...v, [field]: value } : v,
            ),
          }
        : null,
    );
  }
  const locked = disabled || busy;
  return (
    <div className="mt-4 border-t border-zinc-700 pt-4 text-white">
      <button
        type="button"
        disabled={locked}
        className="rounded border border-zinc-600 px-4 py-2 disabled:opacity-50"
        onClick={() => void show()}
      >
        Review unresolved products
      </button>
      {open && (
        <div className="mt-4 space-y-4">
          <div className="flex justify-between gap-3">
            <h3 className="font-semibold">{total} unresolved families</h3>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setFamily(null);
              }}
              disabled={busy}
            >
              Close review
            </button>
          </div>
          <p className="text-sm text-gray-300">
            Corrections stay on this website and are reused by future syncs. Lightspeed is
            unchanged.
          </p>
          {message && (
            <p role="status" className="whitespace-pre-wrap break-words text-sm">
              {message}
            </p>
          )}
          {busy && <p role="status">Loading or saving product…</p>}
          {family ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
              className="space-y-4 rounded border border-zinc-600 p-4"
            >
              <h4 className="text-lg font-semibold">{family.name}</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {family.images.map((image, index) => (
                  <a
                    key={image.id}
                    href={image.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open image ${index + 1} of ${family.name}`}
                  >
                    <Image
                      unoptimized
                      width={320}
                      height={320}
                      src={image.url}
                      alt={`${family.name} — image ${index + 1}`}
                      className="h-64 w-full rounded bg-white object-contain"
                    />
                  </a>
                ))}
              </div>
              {!family.images.length && (
                <p className="rounded border border-zinc-700 p-4 text-gray-300">
                  No images supplied by Lightspeed.
                </p>
              )}
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-gray-400">Brand</dt>
                  <dd>{family.brand || "Not supplied"}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Lightspeed category</dt>
                  <dd>{family.providerCategory}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Total Lightspeed quantity</dt>
                  <dd>{family.quantity ?? "Unknown"}</dd>
                </div>
              </dl>
              <div>
                <h5 className="font-semibold">Description</h5>
                <p className="whitespace-pre-wrap break-words text-sm text-gray-300">
                  {family.description || "No description supplied by Lightspeed."}
                </p>
              </div>
              <p className="text-xs text-gray-400">
                Quantities include all returned Lightspeed outlets. Negative quantities
                are shown unchanged. Unknown means no inventory record was supplied.
              </p>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={family.exclude}
                  disabled={locked}
                  onChange={(e) => setFamily({ ...family, exclude: e.target.checked })}
                />
                Exclude this family from website imports
              </label>
              {!family.exclude && (
                <>
                  <label className="block">
                    Website category
                    <select
                      className={inputClass}
                      value={family.category}
                      disabled={locked}
                      required
                      onChange={(e) => setFamily({ ...family, category: e.target.value })}
                    >
                      <option value="">Choose category</option>
                      {["sneakers", "clothing", "accessories", "electronics"].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-gray-400">
                      Lightspeed category: {family.providerCategory}
                    </span>
                  </label>
                  <p className="text-sm text-gray-300">
                    For colour-only products, enter a distinct variant label such as “One
                    Size — Green”. Do not guess missing sizes or condition.
                  </p>
                  {family.variants.map((v) => (
                    <fieldset
                      key={v.id}
                      disabled={locked}
                      className="space-y-2 rounded border border-zinc-700 p-3"
                    >
                      <legend className="px-1">SKU: {v.sku}</legend>
                      {v.quantity !== null && v.quantity <= 0 && (
                        <p className="text-sm text-gray-300">
                          Imported with zero sellable stock and hidden from the storefront
                          until stock returns.
                        </p>
                      )}
                      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <dt className="text-gray-400">Lightspeed quantity</dt>
                          <dd>{v.quantity ?? "Unknown"}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-400">Price including tax</dt>
                          <dd>{v.priceIncludingTax ?? "Not supplied"}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-400">Price excluding tax</dt>
                          <dd>{v.priceExcludingTax}</dd>
                        </div>
                        <div>
                          <dt className="text-gray-400">Unit cost</dt>
                          <dd>{v.cost ?? "Not supplied"}</dd>
                        </div>
                      </dl>
                      <p className="text-sm text-gray-300">
                        Lightspeed status: {v.active ? "Active" : "Inactive"}
                      </p>
                      {v.codes.length > 0 && (
                        <p className="break-words text-xs text-gray-300">
                          Codes:{" "}
                          {v.codes
                            .map((code) => `${code.type}: ${code.code}`)
                            .join(" · ")}
                        </p>
                      )}
                      <p className="text-xs text-gray-300">
                        Lightspeed: {v.providerValues}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label>
                          Condition
                          <select
                            required
                            value={v.condition}
                            className={inputClass}
                            onChange={(e) =>
                              editVariant(v.id, "condition", e.target.value)
                            }
                          >
                            <option value="">Choose condition</option>
                            <option value="new">New</option>
                            <option value="used">Used</option>
                          </select>
                        </label>
                        <label>
                          Size / variant label
                          <input
                            required
                            maxLength={100}
                            value={v.size}
                            className={inputClass}
                            onChange={(e) => editVariant(v.id, "size", e.target.value)}
                          />
                        </label>
                      </div>
                    </fieldset>
                  ))}
                </>
              )}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={locked}
                  className="rounded bg-white px-4 py-2 font-semibold text-black disabled:opacity-50"
                >
                  {family.exclude ? "Save exclusion" : "Save and retry this product"}
                </button>
                <button type="button" disabled={busy} onClick={() => setFamily(null)}>
                  Back to queue
                </button>
              </div>
            </form>
          ) : (
            <>
              {!items.length && !busy && <p>No unresolved products on this page.</p>}
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id} className="rounded border border-zinc-700 p-3">
                    <button
                      type="button"
                      disabled={locked}
                      className="text-left underline"
                      onClick={() => void show(item.id)}
                    >
                      {item.name}
                    </button>
                    <p className="break-words text-xs text-gray-400">{item.error}</p>
                    <button
                      type="button"
                      disabled={locked}
                      className="mt-2 text-sm underline"
                      onClick={() => {
                        setMessage(
                          "Save this exclusion to remove any linked listings from the website and skip future imports.",
                        );
                        setFamily({
                          id: item.id,
                          name: item.name,
                          images: [],
                          description: null,
                          brand: null,
                          quantity: null,
                          category: "",
                          providerCategory: "Unavailable",
                          exclude: true,
                          variants: [],
                        });
                      }}
                    >
                      Exclude instead
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-4">
                <button
                  type="button"
                  disabled={locked || page === 0}
                  onClick={() => {
                    setBusy(true);
                    void list(page - 1)
                      .catch(() => setMessage("Could not load page."))
                      .finally(() => setBusy(false));
                  }}
                >
                  Previous
                </button>
                <span>Page {page + 1}</span>
                <button
                  type="button"
                  disabled={locked || (page + 1) * 20 >= total}
                  onClick={() => {
                    setBusy(true);
                    void list(page + 1)
                      .catch(() => setMessage("Could not load page."))
                      .finally(() => setBusy(false));
                  }}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
