"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Globe,
  LayoutDashboard,
  Menu,
  Package,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";

const navItems: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/", label: "Website", icon: Globe },
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/inventory", label: "Inventory", icon: Package },
  { href: "/admin/profile", label: "Account Security", icon: ShieldCheck },
];

export function AdminSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const content = (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">Admin</h2>
        <p className="mt-1 text-xs text-zinc-500">Lightspeed-managed catalog</p>
      </div>
      <nav aria-label="Admin" className="space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 rounded border px-4 py-3 text-sm transition-colors ${
                active
                  ? "border-zinc-700 bg-zinc-950 text-white"
                  : "border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-950 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed right-5 top-5 z-40 rounded bg-red-600 p-3 text-white md:hidden"
        aria-label="Open admin menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-black p-6 md:hidden">
          <div className="mb-8 flex items-center justify-between">
            <span className="text-xl font-bold text-white">Admin Menu</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-zinc-400 hover:text-white"
              aria-label="Close admin menu"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          {content}
        </div>
      ) : null}

      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-zinc-800 bg-zinc-900 p-6 md:block">
        {content}
      </aside>
    </>
  );
}
