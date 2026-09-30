// src/components/shell/Navbar.tsx
"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  ShoppingCart,
  User,
  X,
  ChevronDown,
  Menu,
  Home,
  Settings,
  LogOut,
  Shirt,
  Ruler,
  Tag,
  ShoppingBag,
  Watch,
  Laptop,
  LayoutGrid,
  LayoutDashboard,
} from "lucide-react";

import { SHOE_SIZES, CLOTHING_ALPHA_SIZES, JEAN_SIZES } from "@/config/constants/sizes";
import { logError } from "@/lib/utils/log";
import { isAdminRole, type ProfileRole } from "@/config/constants/roles";
import { useSession } from "@/contexts/SessionContext";

type ActiveMenu = "shop" | "brands" | "shoeSizes" | "clothingSizes" | null;

interface NavbarProps {
  isAuthenticated?: boolean;
  userEmail?: string;
  cartCount?: number;
  role?: ProfileRole | null;
}

function buildStoreHref(params: Record<string, string | string[]>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((entry) => sp.append(key, entry));
      return;
    }
    if (value === undefined || value === null || value === "") {
      return;
    }
    sp.set(key, value);
  });
  const query = sp.toString();
  return query ? `/store?${query}` : "/store";
}

function MenuShell({
  align = "left",
  children,
}: {
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`absolute top-full ${
        align === "left" ? "left-0" : "right-0"
      } pt-3 z-50 opacity-0 pointer-events-none translate-y-2 transition duration-150 group-hover:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0`}
      role="menu"
    >
      <div className="min-w-[500px] max-w-[calc(100vw-2rem)] border border-zinc-800 bg-black shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function MegaLink({
  href,
  icon,
  label,
  description,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="group/item flex gap-3 p-4 hover:bg-zinc-900 transition-colors border-b border-zinc-900 last:border-b-0 cursor-pointer"
    >
      <div className="flex h-10 w-10 items-center justify-center bg-zinc-900 group-hover/item:bg-red-600 transition-colors">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-white">{label}</div>
        <div className="text-xs text-zinc-500 truncate">{description}</div>
      </div>
    </Link>
  );
}

const MENU_SHOE_SIZES = SHOE_SIZES.filter((s) => !s.trim().startsWith("EU"));

const SHOE_SIZE_GROUPS = {
  youth: MENU_SHOE_SIZES.filter((s) => s.includes("Y")),
  mens: MENU_SHOE_SIZES.filter((s) => s.includes("M") && !s.includes("Y")),
};

const BRAND_LOGOS: Record<string, { default: string; hover: string }> = {
  Nike: {
    default: "/images/brands/nike-gray.png",
    hover: "/images/brands/nike-white.png",
  },
  "Air Jordan": {
    default: "/images/brands/air-jordan-gray.png",
    hover: "/images/brands/air-jordan-white.png",
  },
  ASICS: {
    default: "/images/brands/asics-gray.png",
    hover: "/images/brands/asics-white.png",
  },
  Vale: {
    default: "/images/brands/vale-gray.png",
    hover: "/images/brands/vale-white.png",
  },
  Godspeed: {
    default: "/images/brands/godspeed-gray.png",
    hover: "/images/brands/godspeed-white.png",
  },
};

const subscribeToHydration = () => () => {};

export function Navbar({
  isAuthenticated = false,
  userEmail,
  cartCount = 0,
  role = null,
}: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    role: sessionRole,
    isAuthenticated: sessionIsAuthenticated,
    isLoading,
  } = useSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<ActiveMenu>(null);
  const [brandGroups, setBrandGroups] = useState<Array<{ key: string; label: string }>>(
    [],
  );
  const isMounted = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );

  // Build auth URLs with current page as "next" parameter
  const loginUrl = useMemo(() => {
    if (pathname === "/") {
      return "/auth/login";
    }
    return `/auth/login?next=${encodeURIComponent(pathname)}`;
  }, [pathname]);

  const registerUrl = useMemo(() => {
    if (pathname === "/") {
      return "/auth/register";
    }
    return `/auth/register?next=${encodeURIComponent(pathname)}`;
  }, [pathname]);

  // OPTIMIZATION: Session fetching removed - now using SessionContext from layout
  // This eliminates duplicate /api/auth/session calls on every route change

  useEffect(() => {
    const loadBrandGroups = async () => {
      try {
        const response = await fetch("/api/store/catalog/brand-groups");
        const data = await response.json();
        if (response.ok && Array.isArray(data.groups)) {
          setBrandGroups(data.groups);
        }
      } catch (error) {
        logError(error, { layer: "frontend", event: "navbar_load_brand_groups" });
      }
    };

    void loadBrandGroups();
  }, []);

  // Scroll lock when mobile menu is open
  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    // Trigger session update event for SessionContext
    window.dispatchEvent(new CustomEvent("sessionUpdate"));
    router.push("/");
    router.refresh();
  };

  const handleSearchClick = () => window.dispatchEvent(new CustomEvent("openSearch"));
  const handleCartClick = () => window.dispatchEvent(new CustomEvent("openCart"));

  const fallbackGroups = useMemo(
    () => [
      { key: "nike", label: "Nike" },
      { key: "jordan", label: "Air Jordan" },
      { key: "asics", label: "ASICS" },
      { key: "vale", label: "Vale" },
      { key: "godspeed", label: "Godspeed" },
    ],
    [],
  );

  const resolvedBrandGroups = brandGroups.length > 0 ? brandGroups : fallbackGroups;
  const orderedBrandGroups = useMemo(() => {
    const filtered = resolvedBrandGroups.filter(
      (group) =>
        group.key !== "designer" &&
        group.key !== "new_balance" &&
        group.key !== "yeezy" &&
        group.key !== "other",
    );
    const withCustom = [
      ...filtered,
      { key: "vale", label: "Vale" },
      { key: "godspeed", label: "Godspeed" },
    ];
    const unique = new Map<string, { key: string; label: string }>();
    for (const group of withCustom) {
      if (!unique.has(group.label)) {
        unique.set(group.label, group);
      }
    }
    const base = Array.from(unique.values());
    return base.slice().sort((a, b) => a.label.localeCompare(b.label));
  }, [resolvedBrandGroups]);
  const visibleBrandGroups = orderedBrandGroups;
  const shopIconClass =
    "w-5 h-5 text-zinc-400 transition-colors group-hover/item:text-white";

  const shopItems = useMemo(
    () => [
      {
        href: "/store",
        icon: <ShoppingBag className={shopIconClass} />,
        label: "Shop All",
        description: "Browse everything in stock",
      },
      {
        href: buildStoreHref({ category: "sneakers" }),
        icon: <Tag className={shopIconClass} />,
        label: "Sneakers",
        description: "Authentic pairs, ready to ship",
      },
      {
        href: buildStoreHref({ category: "clothing" }),
        icon: <Shirt className={shopIconClass} />,
        label: "Clothing",
        description: "Streetwear essentials & heat",
      },
      {
        href: buildStoreHref({ category: "accessories" }),
        icon: <Watch className={shopIconClass} />,
        label: "Accessories",
        description: "Add-ons, extras, rare finds",
      },
      {
        href: buildStoreHref({ category: "electronics" }),
        icon: <Laptop className={shopIconClass} />,
        label: "Electronics",
        description: "Tech & collectibles",
      },
    ],
    [shopIconClass],
  );

  const brandIconClass = "object-contain transition-opacity duration-150";
  function BrandIcon({ label }: { label: string }) {
    const logo = BRAND_LOGOS[label];
    if (logo) {
      return (
        <div className="relative h-6 w-6">
          <Image
            src={logo.default}
            alt={`${label} logo`}
            fill
            sizes="24px"
            className={`${brandIconClass} opacity-100 group-hover/item:opacity-0`}
          />
          <Image
            src={logo.hover}
            alt={`${label} logo`}
            fill
            sizes="24px"
            className={`${brandIconClass} opacity-0 group-hover/item:opacity-100`}
          />
        </div>
      );
    }
    return (
      <span className="text-xs font-bold text-white">
        {label.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  const brandItems = useMemo(
    () => [
      {
        href: "/brands",
        icon: <LayoutGrid className={shopIconClass} />,
        label: "All Brands",
        description: "Browse every brand we carry",
      },
      ...visibleBrandGroups.map((group) => ({
        href: buildStoreHref({ brand: group.label }),
        icon: <BrandIcon label={group.label} />,
        label: group.label,
        description: `Shop ${group.label} drops`,
      })),
    ],
    [shopIconClass, visibleBrandGroups],
  );

  // OPTIMIZATION: Use session from context (eliminates duplicate API calls)
  const effectiveIsAuthenticated = sessionIsAuthenticated || isAuthenticated;
  const effectiveUserEmail = user?.email ?? userEmail;
  const effectiveRole = sessionRole ?? role ?? null;
  const isAdminUser = effectiveRole ? isAdminRole(effectiveRole) : false;
  const showAuthButtons = !isLoading && !effectiveIsAuthenticated;
  const showAuthLoading = isLoading;

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    setMobileSection(null);
  };

  const mobileOverlay = (
    <div className="md:hidden fixed inset-0 z-[9999] bg-black">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-900 flex items-center justify-between">
          <span className="text-white font-bold text-2xl">Menu</span>
          <button
            onClick={closeMobileMenu}
            className="text-gray-400 hover:text-white cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto py-3">
          <div className="px-3">
            {isAdminUser && (
              <Link
                href="/admin/dashboard"
                onClick={closeMobileMenu}
                className="flex items-center justify-between px-4 py-3 text-gray-200 hover:text-white hover:bg-zinc-900 transition-colors border-b border-zinc-900"
              >
                <span className="flex items-center gap-3">
                  <LayoutDashboard className="w-4 h-4" />
                  Back to admin dashboard
                </span>
              </Link>
            )}

            {/* Sneaker Sizes */}
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-gray-300 hover:text-white hover:bg-zinc-900 transition-colors border-b border-zinc-900 text-left"
              onClick={() =>
                setMobileSection(mobileSection === "shoeSizes" ? null : "shoeSizes")
              }
              aria-expanded={mobileSection === "shoeSizes"}
            >
              <span className="flex items-center gap-3">
                <Ruler className="w-4 h-4" />
                Sneaker Sizes
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${mobileSection === "shoeSizes" ? "rotate-180" : ""}`}
              />
            </button>

            {mobileSection === "shoeSizes" && (
              <div className="border-b border-zinc-900 px-4 py-4">
                <div className="pl-7 grid grid-cols-4 gap-2">
                  {MENU_SHOE_SIZES.map((size) => (
                    <Link
                      key={size}
                      href={buildStoreHref({ category: "sneakers", sizeShoe: size })}
                      onClick={closeMobileMenu}
                      className="px-3 py-2 text-center text-xs text-gray-300 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 transition-colors"
                    >
                      {size}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Clothing Sizes */}
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-gray-300 hover:text-white hover:bg-zinc-900 transition-colors border-b border-zinc-900 text-left"
              onClick={() =>
                setMobileSection(
                  mobileSection === "clothingSizes" ? null : "clothingSizes",
                )
              }
              aria-expanded={mobileSection === "clothingSizes"}
            >
              <span className="flex items-center gap-3">
                <Shirt className="w-4 h-4" />
                Clothing Sizes
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${mobileSection === "clothingSizes" ? "rotate-180" : ""}`}
              />
            </button>

            {mobileSection === "clothingSizes" && (
              <div className="border-b border-zinc-900 px-4 py-4 space-y-4">
                <div className="pl-7">
                  <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    Clothing
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {CLOTHING_ALPHA_SIZES.map((size) => (
                      <Link
                        key={size}
                        href={buildStoreHref({
                          category: "clothing",
                          sizeClothing: size,
                        })}
                        onClick={closeMobileMenu}
                        className="px-3 py-2 text-center text-xs text-gray-300 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 transition-colors"
                      >
                        {size}
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="pl-7">
                  <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    Jeans
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {JEAN_SIZES.map((size) => (
                      <Link
                        key={size}
                        href={buildStoreHref({
                          category: "clothing",
                          sizeClothing: size,
                        })}
                        onClick={closeMobileMenu}
                        className="px-3 py-2 text-center text-xs text-gray-300 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 transition-colors"
                      >
                        {size}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Categories */}
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-gray-300 hover:text-white hover:bg-zinc-900 transition-colors border-b border-zinc-900 text-left"
              onClick={() => setMobileSection(mobileSection === "shop" ? null : "shop")}
              aria-expanded={mobileSection === "shop"}
            >
              <span className="flex items-center gap-3">
                <LayoutGrid className="w-4 h-4" />
                Categories
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${mobileSection === "shop" ? "rotate-180" : ""}`}
              />
            </button>

            {mobileSection === "shop" && (
              <div className="border-b border-zinc-900">
                {shopItems.map((it) => (
                  <Link
                    key={it.label}
                    href={it.href}
                    onClick={closeMobileMenu}
                    className="flex items-center px-4 py-3 pl-11 text-sm text-gray-400 hover:text-white hover:bg-zinc-900 transition-colors"
                  >
                    {it.label}
                  </Link>
                ))}
              </div>
            )}

            {/* Brands */}
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-gray-300 hover:text-white hover:bg-zinc-900 transition-colors border-b border-zinc-900 text-left"
              onClick={() =>
                setMobileSection(mobileSection === "brands" ? null : "brands")
              }
              aria-expanded={mobileSection === "brands"}
            >
              <span className="flex items-center gap-3">
                <Tag className="w-4 h-4" />
                Brands
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${mobileSection === "brands" ? "rotate-180" : ""}`}
              />
            </button>

            {mobileSection === "brands" && (
              <div className="border-b border-zinc-900 py-2">
                <Link
                  href="/brands"
                  onClick={closeMobileMenu}
                  className="flex items-center px-4 py-3 pl-11 text-sm text-gray-200 hover:text-white hover:bg-zinc-900 transition-colors"
                >
                  All Brands
                </Link>
                {visibleBrandGroups.map((group) => (
                  <Link
                    key={group.key}
                    href={buildStoreHref({ brand: group.label })}
                    onClick={closeMobileMenu}
                    className="flex items-center px-4 py-3 pl-11 text-sm text-gray-400 hover:text-white hover:bg-zinc-900 transition-colors"
                  >
                    {group.label}
                  </Link>
                ))}
              </div>
            )}

            {/* Shop All */}
            <Link
              href="/store"
              onClick={closeMobileMenu}
              className="flex items-center justify-between px-4 py-3 text-gray-200 hover:text-white hover:bg-zinc-900 transition-colors border-b border-zinc-900"
            >
              <span className="flex items-center gap-3">
                <ShoppingBag className="w-4 h-4" />
                Shop All
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between h-16">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 relative flex-shrink-0">
              <Image
                src="/images/rdk-logo.png"
                alt="Realdealkickzsc"
                fill
                sizes="40px"
                className="object-contain"
                priority
              />
            </div>
            <span
              className={`text-white font-bold text-lg tracking-tight ${isAdminUser ? "hidden sm:block lg:hidden xl:block" : "hidden sm:block"}`}
            >
              REALDEALKICKZSC
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            <div className="relative group">
              <button
                type="button"
                className="flex items-center gap-1 px-3 py-2 text-gray-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <span className="text-sm">Shop</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              <MenuShell align="left">
                <div className="p-6 border-b border-zinc-900">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Shop Categories
                  </h3>
                </div>
                <div>
                  {shopItems.map((it) => (
                    <MegaLink
                      key={it.label}
                      href={it.href}
                      icon={it.icon}
                      label={it.label}
                      description={it.description}
                    />
                  ))}
                </div>
              </MenuShell>
            </div>

            <div className="relative group">
              <button
                type="button"
                className="flex items-center gap-1 px-3 py-2 text-gray-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <span className="text-sm">Brands</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              <MenuShell align="left">
                <div className="p-6 border-b border-zinc-900">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Shop by Brand
                  </h3>
                  <p className="text-xs text-zinc-600">
                    Premium sneaker & streetwear brands
                  </p>
                </div>

                <div>
                  {brandItems.map((item) => (
                    <MegaLink
                      key={item.label}
                      href={item.href}
                      icon={item.icon}
                      label={item.label}
                      description={item.description}
                    />
                  ))}
                </div>
              </MenuShell>
            </div>

            <div className="relative group">
              <button
                type="button"
                className="flex items-center gap-1 px-3 py-2 text-gray-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <span className="text-sm">Sneaker Sizes</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              <MenuShell align="left">
                <div className="p-6 border-b border-zinc-900">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Find Your Size
                  </h3>
                  <p className="text-xs text-zinc-600">
                    Men&apos;s, Women&apos;s & Youth sizes available
                  </p>
                </div>

                <div className="p-6 space-y-6 max-h-[400px] overflow-y-auto custom-scrollbar">
                  <div>
                    <div className="text-xs font-bold text-zinc-600 uppercase tracking-wider mb-3">
                      Youth
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {SHOE_SIZE_GROUPS.youth.map((size) => (
                        <Link
                          key={size}
                          href={buildStoreHref({ category: "sneakers", sizeShoe: size })}
                          className="px-3 py-2 text-center text-xs font-semibold text-white bg-zinc-900 hover:bg-red-600 transition-colors border border-zinc-800 hover:border-red-600 cursor-pointer"
                        >
                          {size}
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-bold text-zinc-600 uppercase tracking-wider mb-3">
                      Men&apos;s
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {SHOE_SIZE_GROUPS.mens.map((size) => (
                        <Link
                          key={size}
                          href={buildStoreHref({ category: "sneakers", sizeShoe: size })}
                          className="px-3 py-2 text-center text-xs font-semibold text-white bg-zinc-900 hover:bg-red-600 transition-colors border border-zinc-800 hover:border-red-600 cursor-pointer"
                        >
                          {size}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </MenuShell>
            </div>

            <div className="relative group">
              <button
                type="button"
                className="flex items-center gap-1 px-3 py-2 text-gray-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <span className="text-sm">Clothing Sizes</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              <MenuShell align="left">
                <div className="p-6 border-b border-zinc-900">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Clothing Sizes
                  </h3>
                  <p className="text-xs text-zinc-600">
                    Filter streetwear by your perfect fit
                  </p>
                </div>

                <div className="p-6 space-y-6">
                  <div>
                    <div className="text-xs font-bold text-zinc-600 uppercase tracking-wider mb-3">
                      Clothing
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {CLOTHING_ALPHA_SIZES.map((size) => (
                        <Link
                          key={size}
                          href={buildStoreHref({
                            category: "clothing",
                            sizeClothing: size,
                          })}
                          className="px-3 py-2 text-center text-xs font-semibold text-white bg-zinc-900 hover:bg-red-600 transition-colors border border-zinc-800 hover:border-red-600 cursor-pointer"
                        >
                          {size}
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-bold text-zinc-600 uppercase tracking-wider mb-3">
                      Jeans
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {JEAN_SIZES.map((size) => (
                        <Link
                          key={size}
                          href={buildStoreHref({
                            category: "clothing",
                            sizeClothing: size,
                          })}
                          className="px-3 py-2 text-center text-xs font-semibold text-white bg-zinc-900 hover:bg-red-600 transition-colors border border-zinc-800 hover:border-red-600 cursor-pointer"
                        >
                          {size}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </MenuShell>
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4">
          {isAdminUser && (
            <Link
              href="/admin/dashboard"
              className="whitespace-nowrap rounded border border-zinc-700 px-3 py-2 text-sm text-white hover:bg-zinc-900"
            >
              Back to admin
            </Link>
          )}
          <Link
            href="/"
            className="text-gray-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Home"
          >
            <Home className="w-5 h-5" />
          </Link>

          <button
            onClick={handleSearchClick}
            className="text-gray-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>

          <button
            onClick={handleCartClick}
            className="relative text-gray-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Cart"
          >
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-1 text-[10px] font-semibold text-red-500">
                {cartCount}
              </span>
            )}
          </button>

          {effectiveIsAuthenticated ? (
            <div className="relative group">
              <button
                type="button"
                className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors cursor-pointer"
                data-testid="navbar-user-menu"
              >
                <User className="w-5 h-5" />
                <ChevronDown className="w-3 h-3" />
              </button>

              <div className="absolute right-0 pt-3 z-50 opacity-0 pointer-events-none translate-y-2 transition duration-150 group-hover:opacity-100 group-hover:pointer-events-auto group-hover:translate-y-0">
                <div
                  className="w-64 border border-zinc-800 bg-black shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  {effectiveUserEmail && (
                    <div className="px-4 py-3 border-b border-zinc-900">
                      <p className="text-xs text-zinc-500 truncate">
                        {effectiveUserEmail}
                      </p>
                    </div>
                  )}

                  <Link
                    href="/account"
                    className="flex items-center gap-2 px-4 py-3 text-gray-300 hover:bg-zinc-900 hover:text-white text-sm transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4" />
                    Account Settings
                  </Link>

                  <button
                    onClick={() => {
                      void handleLogout();
                    }}
                    className="flex items-center gap-2 w-full text-left px-4 py-3 text-gray-300 hover:bg-zinc-900 hover:text-white text-sm border-t border-zinc-900 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          ) : showAuthButtons ? (
            <div className="flex items-center gap-2">
              <Link
                href={loginUrl}
                className="px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer"
                data-testid="navbar-login"
              >
                Login
              </Link>
              <Link
                href={registerUrl}
                className="px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer"
                data-testid="navbar-signup"
              >
                Sign Up
              </Link>
            </div>
          ) : showAuthLoading ? (
            <div
              className="flex items-center gap-2"
              aria-label="Loading account"
              data-testid="navbar-auth-loading"
            >
              <div className="h-9 w-9 rounded-full bg-zinc-800 animate-pulse" />
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-3 md:hidden">
          {isAdminUser && (
            <Link
              href="/admin/dashboard"
              className="rounded border border-zinc-700 px-3 py-2 text-sm text-white hover:bg-zinc-900"
            >
              Back to admin
            </Link>
          )}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="text-gray-300 cursor-pointer"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Mobile Menu (Portal to avoid ScrollHeader transform issues) */}
      {isMounted && isMobileMenuOpen ? createPortal(mobileOverlay, document.body) : null}
    </nav>
  );
}
