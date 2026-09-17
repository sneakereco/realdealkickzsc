// app/brands/page.tsx
import Link from "next/link";
import { unstable_cache } from "next/cache";

import { createSupabasePublicClient } from "@/lib/supabase/public";
import { StorefrontService } from "@/modules/catalog/storefront";

const BRANDS_REVALIDATE_SECONDS = 300;
export const revalidate = 300;

const listBrandLabelsCached = unstable_cache(
  async () => {
    const supabase = createSupabasePublicClient();
    const service = new StorefrontService(supabase);
    const { brands } = await service.listFilters();
    return Array.from(new Set(brands.map((b) => b.label).filter(Boolean)));
  },
  ["storefront", "brands"],
  { revalidate: BRANDS_REVALIDATE_SECONDS, tags: ["products:list"] },
);

function buildStoreHref(brand: string) {
  const params = new URLSearchParams();
  params.set("brand", brand);
  return `/store?${params.toString()}`;
}

function normalizeLetter(label: string) {
  const first = label?.trim()?.[0] ?? "";
  return /[a-z]/i.test(first) ? first.toUpperCase() : "#";
}

function sortLabels(labels: string[]) {
  return [...labels].sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    if (aLower === "other") {
      return 1;
    }
    if (bLower === "other") {
      return -1;
    }
    return a.localeCompare(b);
  });
}

const allLetters = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), "#"];

// Original vibe button class (kept)
const pillLink =
  "rounded-full border border-zinc-800/70 px-2.5 py-1 text-[12px] sm:px-3 sm:text-sm text-zinc-300 hover:text-white hover:border-red-600/40 transition-colors";

export default async function BrandsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const qRaw = (sp.q ?? "").trim();
  const q = qRaw.toLowerCase();

  const uniqueLabels = sortLabels(await listBrandLabelsCached());
  const filtered = q
    ? uniqueLabels.filter((label) => label.toLowerCase().includes(q))
    : uniqueLabels;

  const grouped = filtered.reduce<Record<string, string[]>>((acc, label) => {
    const letter = normalizeLetter(label);
    (acc[letter] ??= []).push(label);
    return acc;
  }, {});

  const lettersWithResults = Object.keys(grouped).sort((a, b) => {
    if (a === "#") {
      return 1;
    }
    if (b === "#") {
      return -1;
    }
    return a.localeCompare(b);
  });

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        {/* Breadcrumb (dark) */}
        <nav className="text-[12px] sm:text-sm text-zinc-500 mb-4 sm:mb-5">
          <span className="hover:text-zinc-200 transition-colors">
            <Link href="/">Home</Link>
          </span>
          <span className="mx-2">›</span>
          <span className="text-zinc-300 font-medium">Brands</span>
        </nav>

        {/* Panel (dark) */}
        <div className="border border-zinc-800/70 bg-zinc-950/40 rounded-md overflow-hidden">
          {/* Header */}
          <div className="px-4 py-4 sm:px-5 sm:py-5 border-b border-zinc-800/70 flex items-start justify-between gap-4 sm:gap-5 flex-wrap">
            <div>
              <p className="text-[11px] sm:text-xs uppercase tracking-[0.4em] text-zinc-500">
                Brand Index
              </p>
              <h1 className="text-2xl sm:text-4xl font-bold text-white mt-2 sm:mt-3">
                All Brands
              </h1>
              <p className="text-zinc-400 text-[12px] sm:text-sm mt-2 sm:mt-3">
                Browse by letter or search for a favorite.
              </p>
            </div>

            {/* Search (server GET, dark) */}
            <form action="/brands" method="get" className="w-full sm:w-auto">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="relative w-full sm:w-[360px]">
                  <input
                    name="q"
                    defaultValue={qRaw}
                    placeholder="Search brands..."
                    className="w-full rounded-md border border-zinc-800/70 bg-black px-3 py-2 pr-10 text-[12px] sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-600/30"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  >
                    ⌕
                  </span>
                </div>

                <button
                  type="submit"
                  className="rounded-md border border-zinc-800/70 bg-zinc-950/60 px-3 py-2 text-[12px] sm:text-sm text-zinc-200 hover:text-white hover:border-red-600/40 transition-colors"
                >
                  Search
                </button>

                {qRaw ? (
                  <Link
                    href="/brands"
                    className="rounded-md border border-zinc-800/70 bg-transparent px-3 py-2 text-[12px] sm:text-sm text-zinc-300 hover:text-white hover:border-red-600/40 transition-colors"
                  >
                    Clear
                  </Link>
                ) : null}
              </div>

              <div className="mt-2 text-[11px] sm:text-xs text-zinc-500">
                Showing{" "}
                <span className="text-zinc-200 font-medium">{filtered.length}</span> of{" "}
                <span className="text-zinc-200 font-medium">{uniqueLabels.length}</span>{" "}
                brands
              </div>
            </form>
          </div>

          {/* Go To strip (dark) */}
          <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-zinc-800/70 flex items-center justify-between gap-3 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[12px] sm:text-sm font-medium text-zinc-400">
                Go To:
              </span>

              <div className="flex flex-wrap gap-1 w-full">
                {allLetters.map((letter) => {
                  const has = Boolean(grouped[letter]?.length);

                  const baseBox =
                    "inline-flex h-6 w-6 sm:h-7 sm:w-7 lg:h-8 lg:w-8 items-center justify-center rounded-md border text-[10px] sm:text-[11px] lg:text-[12px] font-medium transition-colors";

                  return has ? (
                    <a
                      key={letter}
                      href={`#brand-${letter}`}
                      className={`${baseBox} border-zinc-800/70 bg-transparent text-zinc-300 hover:text-white hover:border-red-600/40`}
                    >
                      {letter}
                    </a>
                  ) : (
                    <span
                      key={letter}
                      aria-disabled="true"
                      className={`${baseBox} border-zinc-900/70 bg-zinc-950/40 text-zinc-600 cursor-not-allowed`}
                    >
                      {letter}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="text-[11px] sm:text-xs text-zinc-500">
              {lettersWithResults.length ? (
                <span>
                  Sections:{" "}
                  <span className="text-zinc-200 font-medium">
                    {lettersWithResults.length}
                  </span>
                </span>
              ) : (
                <span>No results</span>
              )}
            </div>
          </div>

          {/* Sections */}
          <div className="divide-y divide-zinc-800/70">
            {lettersWithResults.length === 0 ? (
              <div className="px-4 py-8 sm:px-5 sm:py-10">
                <div className="text-white font-semibold">No brands found.</div>
                <div className="text-[12px] sm:text-sm text-zinc-400 mt-1">
                  Try a different search term.
                </div>
              </div>
            ) : (
              lettersWithResults.map((letter) => (
                <section key={letter} id={`brand-${letter}`} className="scroll-mt-24">
                  {/* Section header (dark, original palette) */}
                  <div className="px-4 py-3 sm:px-5 sm:py-4 flex items-center justify-between bg-zinc-950/30 border-b border-zinc-800/70">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full border border-zinc-800/70 text-zinc-200 flex items-center justify-center text-sm sm:text-lg font-semibold">
                        {letter}
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-semibold text-white">
                          {letter === "#" ? "Other" : `Brands`}
                        </h2>
                        <p className="text-[11px] sm:text-xs uppercase tracking-[0.2em] text-zinc-500 mt-0.5">
                          Section {letter}
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] sm:text-xs uppercase tracking-[0.2em] text-zinc-500">
                      {grouped[letter].length} total
                    </span>
                  </div>

                  {/* 3-column list but using your original pill styling */}
                  <div className="px-4 py-4 sm:px-5 sm:py-5">
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 sm:gap-x-10 gap-y-2.5 sm:gap-y-3">
                      {grouped[letter].map((label) => (
                        <li key={label} className="min-w-0">
                          <Link
                            href={buildStoreHref(label)}
                            className={pillLink}
                            title={`Shop ${label}`}
                          >
                            {label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
