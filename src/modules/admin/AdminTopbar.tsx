import Link from "next/link";

export function AdminTopbar() {
  return (
    <div className="bg-zinc-900 border-b border-zinc-800 pl-6 pr-20 md:pr-6 py-6 mb-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-white">Realdealkickzsc Admin</h1>
        <Link
          href="/"
          className="rounded border border-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-800"
        >
          View website
        </Link>
      </div>
    </div>
  );
}
