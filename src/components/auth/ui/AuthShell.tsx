// components/auth/ui/AuthShell.tsx
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

type LeftVariant = "login" | "register" | "2fa" | "forgot";

type AuthShellProps = {
  children: ReactNode;
  leftVariant?: LeftVariant;
};

const LEFT_COPY: Record<LeftVariant, { title: ReactNode; blurb: string }> = {
  login: {
    title: (
      <>
        Authentic sneakers.
        <br />
        Verified sellers.
        <br />
        <span className="text-red-600">Every pair checked.</span>
      </>
    ),
    blurb: "Sign in to pick up right where you left off and view past orders anytime.",
  },
  register: {
    title: (
      <>
        Join Realdealkickzsc.
        <br />
        Buy with confidence.
        <br />
        <span className="text-red-600">Verified every time.</span>
      </>
    ),
    blurb: "Create an account to keep your catalog, cart, and profile in one place.",
  },
  "2fa": {
    title: (
      <>
        Extra security.
        <br />
        Admin access.
        <br />
        <span className="text-red-600">Protected by 2FA.</span>
      </>
    ),
    blurb: "Complete two-factor authentication to access admin tools securely.",
  },
  forgot: {
    title: (
      <>
        Get back in.
        <br />
        Reset securely.
        <br />
        <span className="text-red-600">In minutes.</span>
      </>
    ),
    blurb: "We’ll help you reset your password and regain access safely.",
  },
};

export default function AuthShell({ children, leftVariant = "login" }: AuthShellProps) {
  const copy = LEFT_COPY[leftVariant];

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:flex-1 bg-black items-start justify-center pt-20 p-12">
        <div className="max-w-xl">
          <Link href="/" className="inline-block mb-12">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12">
                <Image
                  src="/images/rdk-logo.png"
                  alt="RDK"
                  fill
                  sizes="48px"
                  className="object-contain"
                  priority
                />
              </div>
              <span className="text-white text-xl font-bold tracking-wider uppercase">
                Realdealkickzsc
              </span>
            </div>
          </Link>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
            {copy.title}
          </h1>

          <p className="text-lg text-zinc-400 leading-relaxed">{copy.blurb}</p>
        </div>
      </div>

      {/* Right side - Auth form */}
      <div className="flex-1 lg:max-w-xl bg-zinc-950 flex items-start justify-center pt-6 sm:pt-10 p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <Link href="/" className="lg:hidden inline-block mb-8">
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10">
                <Image
                  src="/images/rdk-logo.png"
                  alt="RDK"
                  fill
                  sizes="40px"
                  className="object-contain"
                  priority
                />
              </div>
              <span className="text-white text-lg font-bold tracking-wider uppercase">
                Realdealkickzsc
              </span>
            </div>
          </Link>

          {children}
        </div>
      </div>
    </div>
  );
}
