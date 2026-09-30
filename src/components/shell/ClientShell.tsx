// src/components/shell/ClientShell.tsx
"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

import { SearchOverlay } from "@/components/search/SearchOverlay";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Footer } from "@/components/shell/Footer";
import { MobileBottomNav } from "@/components/shell/MobileBottomNav";

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    const handleOpenSearch = () => setSearchOpen(true);
    const handleOpenCart = () => setCartOpen(true);

    window.addEventListener("openSearch", handleOpenSearch);
    window.addEventListener("openCart", handleOpenCart);

    return () => {
      window.removeEventListener("openSearch", handleOpenSearch);
      window.removeEventListener("openCart", handleOpenCart);
    };
  }, []);

  useEffect(() => {
    const isAdminRoute = pathname.startsWith("/admin");
    const isAuthRoute = pathname.startsWith("/auth");
    const routeValue = isAdminRoute ? "admin" : isAuthRoute ? "auth" : "store";
    document.body.dataset.route = routeValue;
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
      {isStoreRoute && <Footer />}
      {isStoreRoute && <MobileBottomNav />}
    </>
  );
}
