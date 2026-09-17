// app/api/auth/otp/verify/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthService } from "@/services/auth-service";
import { setAdminSessionCookie } from "@/lib/http/admin-session-cookie";
import { AdminAuthService } from "@/modules/admin/auth";
import { getRequestIdFromHeaders } from "@/lib/http/request-id";
import { logError } from "@/lib/utils/log";
import { otpVerifySchema } from "@/lib/validation/auth";
import { isAdminRole, isProfileRole } from "@/config/constants/roles";

export async function POST(req: NextRequest) {
  const requestId = getRequestIdFromHeaders(req.headers);
  const body = await req.json().catch(() => null);
  const parsed = otpVerifySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid payload", issues: parsed.error.format(), requestId },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const { email, code } = parsed.data;
    const supabase = await createSupabaseServerClient();
    const authService = new AuthService(supabase);
    const adminAuthService = new AdminAuthService(supabase);

    const { user, profile } = await authService.verifyEmailOtpForSignIn(email, code);

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Invalid or expired code", requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const role = isProfileRole(profile?.role) ? profile.role : "customer";
    const isAdmin = isAdminRole(role);

    // For non-admin users, we're done
    if (!isAdmin) {
      return NextResponse.json(
        { ok: true, isAdmin: false },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    // Admin-specific 2FA checks
    const { requiresTwoFASetup, requiresTwoFAChallenge } =
      await adminAuthService.getMfaRequirements();

    if (requiresTwoFASetup) {
      return NextResponse.json(
        {
          ok: true,
          isAdmin: true,
          requiresTwoFASetup: true,
          requestId,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (requiresTwoFAChallenge) {
      return NextResponse.json(
        {
          ok: true,
          isAdmin: true,
          requiresTwoFAChallenge: true,
          requestId,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    // Already at aal2, set admin cookie
    let res = NextResponse.json<{ ok: true; isAdmin: true; requestId: string }>(
      {
        ok: true,
        isAdmin: true,
        requestId,
      },
      { headers: { "Cache-Control": "no-store" } },
    );

    res = await setAdminSessionCookie(res, user.id);

    return res;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Login failed";

    if (message.includes("Email not confirmed")) {
      return NextResponse.json(
        { ok: false, requiresEmailVerification: true, requestId },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    logError(error, {
      layer: "auth",
      requestId,
      route: "/api/auth/otp/verify",
    });

    return NextResponse.json(
      { ok: false, error: message, requestId },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
