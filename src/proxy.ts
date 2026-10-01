// proxy.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { security, startsWithAny, isCsrfUnsafeMethod } from "@/config/security";
import { createSupabaseProxyClient } from "@/lib/supabase/proxy";
import { refreshSession } from "@/lib/supabase/session-refresh";
import { generateRequestId } from "@/lib/http/request-id";
import { applyRateLimit } from "@/proxy/rate-limit";
import { protectAdminRoute } from "@/proxy/auth";
import { checkCsrf } from "@/proxy/csrf";
import { checkBot } from "@/proxy/bot";
import { canonicalizePath } from "@/proxy/canonicalize";
import { finalizeProxyResponse } from "@/proxy/finalize";
import { checkSiteLock } from "@/proxy/site-lock";

/**
 * @see docs/PROXY_PIPELINE.md
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId();
  const { pathname, hostname } = request.nextUrl;
  // Machine endpoints authenticate in their routes (cron bearer or private callback token).
  if (pathname === "/api/cron/lightspeed" || pathname === "/api/webhooks/lightspeed") {
    return finalizeProxyResponse(NextResponse.next(), requestId);
  }
  const isLocalhost =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  const isLocalDev = isLocalhost;

  const canonicalizeResponse = canonicalizePath(request, requestId);

  if (canonicalizeResponse) {
    return finalizeProxyResponse(canonicalizeResponse, requestId);
  }

  // Refresh Supabase session and get response with cookies
  const sessionResponse = await refreshSession(request);

  // Create forwarded headers with request ID for downstream handlers
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set(security.proxy.requestIdHeader, requestId);

  // Create new response with forwarded headers
  let response = NextResponse.next({
    request: { headers: forwardedHeaders },
  });

  // Copy all Supabase session cookies to the new response
  sessionResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie);
  });

  // Site lock gate (storefront lock with admin bypass)
  const siteLockResponse = await checkSiteLock(request, requestId);
  if (siteLockResponse) {
    // preserve refreshed auth cookies on the lock response
    sessionResponse.cookies.getAll().forEach((cookie) => {
      siteLockResponse.cookies.set(cookie.name, cookie.value, cookie);
    });

    return finalizeProxyResponse(siteLockResponse, requestId);
  }

  response = finalizeProxyResponse(response, requestId);

  if (!isLocalDev && startsWithAny(pathname, security.proxy.botCheckPrefixes)) {
    const botResponse = checkBot(request, requestId);

    if (botResponse) {
      return finalizeProxyResponse(botResponse, requestId);
    }
  }

  if (isCsrfUnsafeMethod(request.method)) {
    const csrfResponse = checkCsrf(request, requestId);

    if (csrfResponse) {
      return finalizeProxyResponse(csrfResponse, requestId);
    }
  }

  const shouldApplyRateLimit =
    (security.proxy.rateLimit.applyInLocalDev || !isLocalDev) &&
    startsWithAny(pathname, security.proxy.rateLimitPrefixes);

  if (shouldApplyRateLimit) {
    const rateLimitResponse = await applyRateLimit(request, requestId);

    if (rateLimitResponse) {
      return finalizeProxyResponse(rateLimitResponse, requestId);
    }
  }

  const isAdminArea = startsWithAny(
    pathname,
    security.proxy.adminGuard.protectedPrefixes,
  );

  const isExemptRoute = startsWithAny(pathname, security.proxy.adminGuard.exemptPrefixes);

  if (isAdminArea && !isExemptRoute) {
    const supabase = createSupabaseProxyClient(request);

    const adminResponse = await protectAdminRoute(request, requestId, supabase);

    if (adminResponse) {
      return finalizeProxyResponse(adminResponse, requestId);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next|static|favicon.ico|robots.txt|sitemap.xml).*)"],
};
