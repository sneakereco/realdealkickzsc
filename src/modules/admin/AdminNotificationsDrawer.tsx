"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

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

const getNotificationHref = (n: AdminNotification) => {
  if (n.chat_id) {
    return `/admin/chats?chatId=${n.chat_id}`;
  }
  return "/admin/dashboard";
};

type Props = {
  onClose: () => void;
};

type ListResponse = {
  notifications: AdminNotification[];
  unreadCount: number;
  hasMore: boolean;
  page: number;
  limit: number;
};

function emitUnreadCountUpdated(unreadCount: number) {
  window.dispatchEvent(
    new CustomEvent("adminNotificationsUpdated", { detail: { unreadCount } }),
  );
}

export function AdminNotificationsDrawer({ onClose }: Props) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // prevent unread count flash before first load
  const [unreadCountServer, setUnreadCountServer] = useState<number | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const unreadCountLocal = useMemo(
    () => notifications.filter((n) => !n.read_at).length,
    [notifications],
  );

  const load = async () => {
    try {
      const res = await fetch(`/api/admin/notifications?limit=20&page=1`, {
        cache: "no-store",
      });
      if (!res.ok) {
        return;
      }

      const data = (await res.json()) as ListResponse;
      setNotifications(data.notifications ?? []);
      setUnreadCountServer(
        typeof data.unreadCount === "number" ? data.unreadCount : null,
      );

      if (typeof data.unreadCount === "number") {
        emitUnreadCountUpdated(data.unreadCount);
      }
      setHasLoaded(true);
    } catch (error) {
      logError(error, { layer: "frontend", event: "admin_load_notifications_drawer" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadInitial = async () => {
      try {
        const res = await fetch(`/api/admin/notifications?limit=20&page=1`, {
          cache: "no-store",
        });
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as ListResponse;
        setNotifications(data.notifications ?? []);
        setUnreadCountServer(
          typeof data.unreadCount === "number" ? data.unreadCount : null,
        );
        if (typeof data.unreadCount === "number") {
          emitUnreadCountUpdated(data.unreadCount);
        }
        setHasLoaded(true);
      } catch (error) {
        logError(error, { layer: "frontend", event: "admin_load_notifications_drawer" });
      } finally {
        setIsLoading(false);
      }
    };
    void loadInitial();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const markRead = async (id: string) => {
    try {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
      setUnreadCountServer((v) => {
        const next = typeof v === "number" ? Math.max(0, v - 1) : v;
        if (typeof next === "number") {
          emitUnreadCountUpdated(next);
        }
        return next;
      });
    } catch (error) {
      logError(error, {
        layer: "frontend",
        event: "admin_mark_notification_read_drawer",
      });
    }
  };

  const markAll = async () => {
    try {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all: true }),
      });

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
      );
      setUnreadCountServer(0);
      emitUnreadCountUpdated(0);
    } catch (error) {
      logError(error, {
        layer: "frontend",
        event: "admin_mark_all_notifications_drawer",
      });
    }
  };

  const showUnread = unreadCountServer !== null && hasLoaded;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div
        className="absolute inset-x-0 bottom-0 h-[80vh] max-h-[80vh] w-full bg-black border-t border-zinc-800/70 overflow-y-auto rounded-t-2xl
                      md:rounded-none md:inset-y-0 md:right-0 md:left-auto md:h-auto md:max-h-none md:max-w-md md:border-t-0 md:border-l"
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-2xl font-bold text-white">Notifications</h2>
              <p className="text-xs text-zinc-500 mt-1">
                {isLoading && !hasLoaded
                  ? "Loading..."
                  : showUnread
                    ? `Unread: ${unreadCountServer}`
                    : `Unread: ${unreadCountLocal}`}
              </p>
            </div>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex items-center justify-between border-b border-zinc-800/70 pb-3 mb-4">
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                void load();
              }}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Refresh
            </button>

            <div className="flex items-center gap-4">
              <Link
                href="/admin/notifications"
                onClick={onClose}
                className="text-xs text-zinc-400 hover:text-white"
              >
                View all notifications
              </Link>

              <button
                type="button"
                onClick={() => {
                  void markAll();
                }}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Mark all as read
              </button>
            </div>
          </div>

          {isLoading && !hasLoaded ? (
            <div className="text-sm text-zinc-500 py-8 text-center">
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-sm text-zinc-500 py-10 text-center">
              No notifications yet.
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <Link
                  key={n.id}
                  href={getNotificationHref(n)}
                  onClick={() => {
                    onClose();
                    if (!n.read_at) {
                      void markRead(n.id);
                    }
                  }}
                  className={`block min-w-0 border border-zinc-800/70 bg-zinc-950 hover:bg-zinc-900 transition px-4 py-3 rounded-sm ${
                    n.read_at ? "text-zinc-400" : "text-white"
                  }`}
                  data-testid="admin-notification-item"
                >
                  <div className="text-sm font-medium break-words whitespace-pre-wrap">
                    {n.message}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {formatTime(n.created_at)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
