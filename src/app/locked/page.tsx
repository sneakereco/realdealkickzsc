import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { isAdminRole } from "@/config/constants/roles";
import { getServerSession } from "@/lib/auth/session";
import { getStoreAccessSettings } from "@/lib/store-access/get-store-access-settings";

import { UnlockTimer } from "./unlock-timer";

export const dynamic = "force-dynamic";

function formatUnlock(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export default async function LockedPage(props: {
  searchParams?: Promise<{ next?: string }> | { next?: string };
}) {
  const sp = props.searchParams ? await Promise.resolve(props.searchParams) : undefined;
  const next = sp?.next || "/";
  const session = await getServerSession();
  if (session && isAdminRole(session.role)) {
    redirect(next);
  }

  const storeAccess = await getStoreAccessSettings();
  const unlockAtIso = storeAccess?.settings.siteUnlockAt ?? null;
  const unlockFullDate = unlockAtIso ? formatUnlock(unlockAtIso) : null;

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      {unlockAtIso ? <UnlockTimer unlockAtIso={unlockAtIso} /> : null}

      <div className="relative overflow-hidden rounded-3xl border-2 border-zinc-800/80 bg-black shadow-2xl">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_50%_0%,rgba(220,38,38,0.35),transparent_60%),linear-gradient(to_bottom,rgba(0,0,0,0.98),rgba(0,0,0,0.92),rgba(220,38,38,0.10))]" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_120%_at_50%_60%,transparent_40%,rgba(0,0,0,0.92)_80%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/70 to-transparent" />
        <div className="pointer-events-none absolute -top-28 left-1/2 h-64 w-[32rem] -translate-x-1/2 rounded-full bg-red-600/12 blur-3xl" />

        <div className="relative flex min-h-[calc(100vh-12rem)] items-center px-6 py-14">
          <div className="w-full px-2 text-center sm:px-8">
            <div className="mb-8 flex items-center justify-center gap-3">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-zinc-800/70 bg-black">
                <Image
                  src="/images/rdk-logo.png"
                  alt="Realdealkickzsc"
                  fill
                  sizes="44px"
                  className="object-contain p-2"
                  priority
                />
              </div>
              <div className="text-lg font-extrabold tracking-[0.12em] text-white sm:text-xl">
                REALDEALKICKZSC
              </div>
            </div>

            <h1 className="text-2xl font-semibold text-white sm:text-4xl">
              The site is currently locked
            </h1>
            <p className="mt-3 text-sm text-zinc-300 sm:text-base">
              We&apos;re temporarily closed to the public while we prepare the site.
            </p>

            <div className="mt-4 flex flex-col items-center gap-1">
              <p className="text-sm text-zinc-300 sm:text-base">
                The site unlocks in:{" "}
                <span className="font-mono font-bold text-red-500">
                  {unlockAtIso ? <UnlockTimer unlockAtIso={unlockAtIso} /> : "soon"}
                </span>
              </p>
              {unlockFullDate ? (
                <p className="text-xs italic text-zinc-500">{unlockFullDate}</p>
              ) : null}
            </div>

            <div className="mt-8 flex flex-col items-center gap-3">
              <Link
                href={`/auth/login?next=${encodeURIComponent(next)}`}
                className="inline-flex items-center justify-center rounded-xl bg-red-600 px-6 py-3 text-sm font-semibold text-white transition-all shadow-lg shadow-red-600/25 hover:scale-105 hover:bg-red-700"
              >
                If you&apos;re an admin, sign in here
              </Link>

              <p className="text-xs text-zinc-500">
                Not an admin? The site will refresh automatically at drop time.
              </p>
            </div>

            <div className="mt-10 text-[11px] uppercase tracking-widest text-zinc-500">
              Authentic sneakers • Browse the catalog • Message us to purchase
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
