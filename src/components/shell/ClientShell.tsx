// src/components/shell/ClientShell.tsx
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { CartDrawer } from "@/components/cart/CartDrawer";
import { ChatDrawer } from "@/components/chat/ChatDrawer";
import { ChatLauncher } from "@/components/chat/ChatLauncher";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { Footer } from "@/components/shell/Footer";
import { MobileBottomNav } from "@/components/shell/MobileBottomNav";

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const openChat = useCallback(() => setChatOpen(true), []);

  useEffect(() => {
    const handleOpenSearch = () => setSearchOpen(true);
    const handleOpenCart = () => setCartOpen(true);
    const handleOpenChat = () => setChatOpen(true);
    window.addEventListener("openSearch", handleOpenSearch);
    window.addEventListener("openCart", handleOpenCart);
    window.addEventListener("openChat", handleOpenChat);
    return () => {
      window.removeEventListener("openSearch", handleOpenSearch);
      window.removeEventListener("openCart", handleOpenCart);
      window.removeEventListener("openChat", handleOpenChat);
    };
  }, []);

  useEffect(() => {
    const isAdminRoute = pathname.startsWith("/admin");
    const isAuthRoute = pathname.startsWith("/auth");
    document.body.dataset.route = isAdminRoute ? "admin" : isAuthRoute ? "auth" : "store";
  }, [pathname]);

  const isAdminRoute = pathname.startsWith("/admin");
  const isAuthRoute = pathname.startsWith("/auth");
  const isCheckoutRoute = pathname.startsWith("/checkout");
  const isLockedRoute = pathname.startsWith("/locked");
  const isStoreRoute =
    !isAdminRoute && !isAuthRoute && !isCheckoutRoute && !isLockedRoute;

  return (
    <>
      {children}
      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
      <Suspense fallback={null}>
        <ChatQueryOpener onOpenChat={openChat} />
      </Suspense>
      {isStoreRoute && <ChatLauncher />}
      {isStoreRoute && chatOpen ? <ChatDrawer onClose={() => setChatOpen(false)} /> : null}
      {isStoreRoute && <Footer />}
      {isStoreRoute && <MobileBottomNav />}
    </>
  );
}

function ChatQueryOpener({ onOpenChat }: { onOpenChat: () => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("chat") === "1") onOpenChat();
  }, [onOpenChat, searchParams]);
  return null;
}
