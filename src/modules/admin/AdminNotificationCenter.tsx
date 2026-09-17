"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { logError } from "@/lib/utils/log";

type AdminNotification = {
  id: string;
  type: "chat_message";
  message: string;
  created_at: string;
  read_at: string | null;
  chat_id?: string | null;
};

const formatTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

const getNotificationHref = (notification: AdminNotification) => {
  if (notification.chat_id) {
    return `/admin/chats?chatId=${notification.chat_id}`;
  }
  return "/admin/dashboard";
};

type Props = {
  placement?: "top" | "bottom"; // top = dropdown opens upward (for bottom dock)
};

export function AdminNotificationCenter({ placement = "top" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHover, setIsHover] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read_at).length,
    [notifications],
  );

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/notifications?limit=20&page=1", {
        cache: "no-store",
      });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setNotifications(data.notifications ?? []);
    } catch (error) {
      logError(error, { layer: "frontend", event: "admin_load_notifications" });
    } finally {
      setIsLoading(false);
    }
  };

  // Close on outside click + Esc (prevents weird stuck popovers)
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const markRead = async (id: string) => {
    try {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, read_at: new Date().toISOString() } : item,
        ),
      );
    } catch (error) {
      logError(error, { layer: "frontend", event: "admin_mark_notification_read" });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all: true }),
      });
      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          read_at: item.read_at ?? new Date().toISOString(),
        })),
      );
    } catch (error) {
      logError(error, {
        layer: "frontend",
        event: "admin_mark_all_notifications",
      });
    }
  };

  const panelClass =
    placement === "top"
      ? "absolute right-0 bottom-full mb-3"
      : "absolute right-0 top-full mt-3";

  const tooltipClass =
    placement === "top"
      ? "absolute left-1/2 -translate-x-1/2 bottom-full mb-2"
      : "absolute left-1/2 -translate-x-1/2 top-full mt-2";

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
    >
      <button
        type="button"
        onClick={() => {
          const nextIsOpen = !isOpen;
          setIsOpen(nextIsOpen);
          if (nextIsOpen) {
            void loadNotifications();
          }
        }}
        className="relative flex items-center justify-center w-10 h-10 border border-zinc-800/70 bg-zinc-950 hover:bg-zinc-900 transition-colors rounded-sm"
        aria-label="Notifications"
        data-testid="admin-notifications-toggle"
      >
        <Bell className="w-5 h-5 text-zinc-200" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-sm">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Hover tooltip (overlaps, no layout shift) */}
      {isHover && !isOpen && (
        <div className={`${tooltipClass} pointer-events-none z-50`}>
          <div className="bg-zinc-950 border border-zinc-800/70 text-zinc-200 text-xs px-2 py-1 rounded-sm shadow-lg whitespace-nowrap">
            Notifications
          </div>
        </div>
      )}

      {/* Click popover (overlaps, no layout shift) */}
      {isOpen && (
        <div
          className={`${panelClass} w-80 bg-zinc-950 border border-zinc-800/70 shadow-xl z-50`}
        >
          <div className="p-4 border-b border-zinc-800/70">
            <div className="text-white font-semibold">Notifications</div>
            <div className="text-xs text-zinc-500">Latest activity for your store.</div>
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-sm text-zinc-500">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-sm text-zinc-500">No notifications yet.</div>
            ) : (
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={getNotificationHref(notification)}
                  onClick={() => {
                    setIsOpen(false);
                    if (!notification.read_at) {
                      void markRead(notification.id);
                    }
                  }}
                  className={`block min-w-0 px-4 py-3 border-b border-zinc-900/70 hover:bg-zinc-900 transition ${
                    notification.read_at ? "text-zinc-400" : "text-white"
                  }`}
                  data-testid="admin-notification-item"
                >
                  <div className="text-sm font-medium break-words whitespace-pre-wrap">
                    {notification.message}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {formatTime(notification.created_at)}
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className="border-t border-zinc-800/70 p-3 flex items-center justify-between">
            <Link
              href="/admin/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs text-zinc-400 hover:text-white"
            >
              View all
            </Link>
            <button
              type="button"
              onClick={() => {
                void handleMarkAllRead();
              }}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Mark all as read
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
