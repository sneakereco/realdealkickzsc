// app/layout.tsx

import type { Metadata, Viewport } from "next";

import { CartProvider } from "@/components/cart/CartProvider";
import { CloudflareWebAnalytics } from "@/modules/analytics";
import { ScrollHeader } from "@/components/shell/ScrollHeader";
import { ClientShell } from "@/components/shell/ClientShell";
import { SessionProvider } from "@/contexts/SessionContext";
import { getServerSession } from "@/lib/auth/session";
import "@/styles/global.css";

export const metadata: Metadata = {
  title: "Realdealkickzsc - Premium Sneakers & Streetwear",
  description: "Authentic sneakers and streetwear. Quality guaranteed.",
};

// OPTIMIZATION: Proper viewport configuration for mobile performance
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5, // Allow zooming for accessibility
  minimumScale: 1,
  userScalable: true,
  viewportFit: "cover", // Safe area insets on iOS
  // Theme color for mobile browsers
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  const isAuthenticated = Boolean(session);

  const role = session?.role ?? null;
  const userEmail = session?.user.email ?? session?.profile?.email;
  const userId = session?.user.id ?? null;

  // OPTIMIZATION: Prepare session for client-side context
  const sessionUser = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
      }
    : null;

  return (
    <html lang="en">
      <body className="bg-black text-white">
        <SessionProvider initialUser={sessionUser} initialRole={role}>
          <CartProvider userId={userId}>
            <ClientShell>
              <ScrollHeader
                isAuthenticated={isAuthenticated}
                userEmail={userEmail}
                role={role}
              />
              <main className="min-h-screen pt-16 pb-20 md:pb-0">{children}</main>
            </ClientShell>
          </CartProvider>
        </SessionProvider>
        <CloudflareWebAnalytics />
      </body>
    </html>
  );
}
