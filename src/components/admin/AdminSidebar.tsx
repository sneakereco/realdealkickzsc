// src/components/admin/AdminSidebar.tsx
"use client";

import { createElement, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  Bell,
  LayoutDashboard,
  Package,
  Settings,
  MessageCircle,
  Globe,
  X,
  Menu,
  ChevronDown,
  ChevronRight,
  Landmark,
  Receipt,
  Star,
  type LucideIcon,
} from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { canViewBank } from "@/config/constants/roles";
import type { ProfileRole } from "@/config/constants/roles";
import { Tooltip } from "@/components/ui/Tooltip";
import { AdminNotificationsDrawer } from "@/components/admin/AdminNotificationsDrawer";

type NavLinkItem = {
  type: "link";
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavGroupItem = {
  type: "group";
  label: string;
  icon: LucideIcon;
  groupKey: "settings";
  isActive: (pathname: string) => boolean;
  children: Array<{ href: string; label: string }>;
};

type ChatSummary = {
  id: string;
  messages?: Array<{ sender_role?: "customer" | "admin" | null }> | null;
};

const navItems: Array<NavLinkItem | NavGroupItem> = [
  { type: "link", href: "/", label: "Website", icon: Globe },
  { type: "link", href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { type: "link", href: "/admin/inventory", label: "Inventory", icon: Package },
  { type: "link", href: "/admin/customers", label: "Customers", icon: User },
  { type: "link", href: "/admin/bank", label: "Bank", icon: Landmark },
  { type: "link", href: "/admin/nexus", label: "Tax & Nexus", icon: Receipt },
  { type: "link", href: "/admin/featured-items", label: "Featured Items", icon: Star }, // ADD THIS LINE
  { type: "link", href: "/admin/catalog", label: "Tags", icon: Package },
  {
    type: "group",
    label: "Settings",
    icon: Settings,
    groupKey: "settings",
    isActive: (pathname: string) => pathname.startsWith("/admin/settings"),
    children: [
      { href: "/admin/settings/store-access", label: "Store Access" },
      { href: "/admin/settings/transfers", label: "Bank" },
    ],
  },
];

export function AdminSidebar({
  userEmail: _userEmail,
  role,
}: {
  userEmail?: string | null;
  role: ProfileRole;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [chatBadgeCount, setChatBadgeCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);

  const chatLastSenderRef = useRef(new Map<string, "customer" | "admin" | "none">());
  const pathname = usePathname();

  const [openGroups, setOpenGroups] = useState({
    settings: false,
  });

  const [notifBadgeCount, setNotifBadgeCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    const refreshNotifCount = async () => {
      try {
        const res = await fetch("/api/admin/notifications/unread-count", {
          cache: "no-store",
        });
        if (!res.ok) {
          return;
        }
        const data = await res.json();
        if (typeof data.unreadCount === "number") {
          setNotifBadgeCount(data.unreadCount);
        }
      } catch {
        // keep last value; do not force 0
      }
    };

    void refreshNotifCount();

    const onUpdated = (e: Event) => {
      const evt = e as CustomEvent;
      const next = evt.detail?.unreadCount;
      if (typeof next === "number") {
        setNotifBadgeCount(next);
      }
    };

    window.addEventListener("adminNotificationsUpdated", onUpdated);
    return () => window.removeEventListener("adminNotificationsUpdated", onUpdated);
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadChatBadge = async () => {
      try {
        const response = await fetch("/api/chats?status=open", { cache: "no-store" });
        const data = await response.json();
        const chats = (data.chats ?? []) as ChatSummary[];
        const nextMap = new Map<string, "customer" | "admin" | "none">();

        chats.forEach((chat) => {
          const lastMessage = chat.messages?.[0];
          if (!lastMessage) {
            nextMap.set(chat.id, "none");
            return;
          }
          nextMap.set(chat.id, lastMessage.sender_role ?? "none");
        });

        chatLastSenderRef.current = nextMap;

        const count = Array.from(nextMap.values()).filter(
          (senderRole) => senderRole !== "admin",
        ).length;
        if (isActive) {
          setChatBadgeCount(count);
        }
      } catch {
        if (isActive) {
          setChatBadgeCount(0);
        }
      }
    };

    void loadChatBadge();

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("admin-sidebar-chats")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chats" },
        (payload) => {
          const chat = payload.new as { id: string; status?: string | null };
          if (chat.status && chat.status !== "open") {
            return;
          }
          chatLastSenderRef.current.set(chat.id, "none");

          if (isActive) {
            const count = Array.from(chatLastSenderRef.current.values()).filter(
              (senderRole) => senderRole !== "admin",
            ).length;
            setChatBadgeCount(count);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chats" },
        (payload) => {
          const chat = payload.new as { id: string; status?: string | null };
          if (chat.status && chat.status !== "open") {
            chatLastSenderRef.current.delete(chat.id);
          } else if (!chatLastSenderRef.current.has(chat.id)) {
            chatLastSenderRef.current.set(chat.id, "none");
          }

          if (isActive) {
            const count = Array.from(chatLastSenderRef.current.values()).filter(
              (senderRole) => senderRole !== "admin",
            ).length;
            setChatBadgeCount(count);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const message = payload.new as {
            chat_id: string;
            sender_role?: "customer" | "admin";
          };
          if (!chatLastSenderRef.current.has(message.chat_id)) {
            return;
          }

          chatLastSenderRef.current.set(message.chat_id, message.sender_role ?? "none");

          if (isActive) {
            const count = Array.from(chatLastSenderRef.current.values()).filter(
              (senderRole) => senderRole !== "admin",
            ).length;
            setChatBadgeCount(count);
          }
        },
      )
      .subscribe();

    return () => {
      isActive = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  function renderSidebarContent() {
    const canViewBankTab = canViewBank(role);
    const baseItemClass =
      "group flex items-center gap-3 px-4 py-3 border border-transparent bg-transparent " +
      "hover:bg-zinc-950 hover:border-zinc-800/70 transition-colors rounded-sm";

    const activeItemClass = "bg-zinc-950 border-zinc-800/70 text-white";
    const inactiveItemClass = "text-gray-400";

    const inAdmin = pathname.startsWith("/admin");

    const statusBase =
      "flex w-full items-center gap-2 px-3 py-2 rounded-sm select-none " +
      "text-[12px] sm:text-[13px] leading-none bg-zinc-950 text-white";

    const notifLabel =
      typeof notifBadgeCount === "number" && notifBadgeCount > 9
        ? "9+"
        : String(notifBadgeCount ?? 0);

    // Match notifications style: red text only, no box.
    const chatLabel = chatBadgeCount > 9 ? "9+" : String(chatBadgeCount);

    return (
      <div className="flex flex-col h-full min-h-0 w-full">
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1 admin-sidebar-scroll">
          {/* Workspace Indicator (visual only) */}
          <div className="mb-4">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2">
              Workspace
            </div>

            <div className={statusBase} aria-current="page">
              {inAdmin ? (
                <>
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="font-medium">Admin</span>
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4" />
                  <span className="font-medium">Website</span>
                </>
              )}
            </div>

            <div className="mt-4 border-t border-zinc-800/70" />
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              if (item.type === "link") {
                if (item.href === "/admin/bank" && !canViewBankTab) {
                  return null;
                }
                const icon = item.icon;
                const isActive =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`${baseItemClass} ${isActive ? activeItemClass : inactiveItemClass}`}
                    data-testid={
                      item.href === "/admin/bank" ? "admin-nav-bank" : undefined
                    }
                  >
                    {createElement(icon, { className: "w-5 h-5" })}
                    <span className="text-[13px] sm:text-[15px]">{item.label}</span>
                  </Link>
                );
              }

              // group
              const icon = item.icon;
              const isGroupActive = item.isActive(pathname);
              const isGroupOpen = openGroups[item.groupKey] || isGroupActive;
              const chevron = isGroupOpen ? ChevronDown : ChevronRight;

              const filteredChildren = item.children.filter(
                (child) => child.href !== "/admin/settings/transfers" || canViewBankTab,
              );
              if (filteredChildren.length === 0) {
                return null;
              }

              return (
                <div key={item.label} className="space-y-1">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenGroups((prev) => ({
                        ...prev,
                        [item.groupKey]: !prev[item.groupKey],
                      }))
                    }
                    className={`${baseItemClass} w-full justify-between ${
                      isGroupActive ? activeItemClass : inactiveItemClass
                    }`}
                    aria-expanded={isGroupOpen}
                    aria-controls={`admin-${item.groupKey}-subnav`}
                  >
                    <span className="flex items-center gap-3">
                      {createElement(icon, { className: "w-5 h-5" })}
                      <span className="text-[13px] sm:text-[15px]">{item.label}</span>
                    </span>
                    {createElement(chevron, { className: "w-4 h-4 opacity-80" })}
                  </button>

                  {isGroupOpen && (
                    <div
                      id={`admin-${item.groupKey}-subnav`}
                      className="ml-4 border-l border-zinc-800/70 pl-3 space-y-1"
                    >
                      {filteredChildren.map((child) => {
                        const isActive = pathname.startsWith(child.href);

                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setIsOpen(false)}
                            className={`flex items-center px-3 py-2 border border-transparent rounded-sm transition-colors ${
                              isActive
                                ? "bg-red-900/20 text-white border-red-900/30"
                                : "text-gray-400 hover:bg-zinc-950 hover:border-zinc-800/70 hover:text-white"
                            }`}
                          >
                            <span className="text-[12px] sm:text-[14px]">
                              {child.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom dock */}
        <div className="sticky bottom-0 left-0 w-full flex-none self-stretch">
          {/* Full-width divider */}
          <div className="-mx-6 w-[calc(100%+3rem)] border-t border-zinc-800/70" />

          {/* Dock background spans edge-to-edge (cancels parent p-6) */}
          <div className="-mx-6 w-[calc(100%+3rem)] bg-zinc-950 px-6 py-3">
            <div className="grid w-full grid-cols-3 items-center">
              {/* Profile */}
              <Tooltip label="Profile" side="top">
                <Link
                  href="/admin/profile"
                  onClick={() => setIsOpen(false)}
                  aria-label="Profile"
                  className="flex h-12 w-full items-center justify-center rounded-sm
                            hover:bg-zinc-900 transition-colors
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600/40"
                >
                  <User className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
                </Link>
              </Tooltip>

              {/* Messages */}
              <Tooltip label="Messages" side="top">
                <Link
                  href="/admin/chats"
                  onClick={() => setIsOpen(false)}
                  aria-label="Messages"
                  className="flex h-12 w-full items-center justify-center rounded-sm
                            hover:bg-zinc-900 transition-colors
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600/40"
                >
                  <span className="relative">
                    <MessageCircle className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
                    {chatBadgeCount > 0 && (
                      <span className="absolute -top-2 -right-2 text-[10px] font-semibold text-red-500">
                        {chatLabel}
                      </span>
                    )}
                  </span>
                </Link>
              </Tooltip>

              {/* Notifications */}
              <Tooltip label="Notifications" side="top">
                <button
                  type="button"
                  onClick={() => setNotifOpen(true)}
                  aria-label="Notifications"
                  data-testid="admin-notifications-toggle"
                  className="flex h-12 w-full items-center justify-center rounded-sm
                            hover:bg-zinc-900 transition-colors
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600/40"
                >
                  <span className="relative">
                    <Bell className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
                    {typeof notifBadgeCount === "number" && notifBadgeCount > 0 && (
                      <span className="absolute -top-2 -right-2 text-[10px] font-semibold text-red-500">
                        {notifLabel}
                      </span>
                    )}
                  </span>
                </button>
              </Tooltip>
            </div>
          </div>

          {notifOpen && <AdminNotificationsDrawer onClose={() => setNotifOpen(false)} />}
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-5 right-5 z-40 bg-red-600 text-white p-3 rounded-sm shadow-lg"
        aria-label="Open admin menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="md:hidden fixed inset-0 bg-black z-50 overscroll-contain">
          <div className="px-6 pt-6 pb-0 h-full flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-white">Admin Menu</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 min-h-0">{renderSidebarContent()}</div>
          </div>
        </div>
      )}

      <aside className="hidden md:block fixed left-0 top-0 w-64 h-screen bg-zinc-900 border-r border-zinc-800/70 p-6 z-40">
        <h2 className="text-2xl font-bold text-white mb-8">Admin</h2>
        {renderSidebarContent()}
      </aside>
    </>
  );
}
