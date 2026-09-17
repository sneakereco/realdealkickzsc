// app/api/auth/forgot-password/verify-code/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AuthService } from "@/services/auth-service";
import { AdminAuthService } from "@/modules/admin/auth";
import { getRequestIdFromHeaders } from "@/lib/http/request-id";
import { logError } from "@/lib/utils/log";
import { otpVerifySchema } from "@/lib/validation/auth";
import { isAdminRole, isProfileRole } from "@/config/constants/roles";

export async function POST(req: NextRequest) {
  const requestId = getRequestIdFromHeaders(req.headers);

  try {
    const body = await req.json().catch(() => null);
    const parsed = otpVerifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload", issues: parsed.error.format(), requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { email, code } = parsed.data;

    const supabase = await createSupabaseServerClient();
    const authService = new AuthService(supabase);
    const adminAuthService = new AdminAuthService(supabase);

    // This establishes a recovery session
    await authService.verifyPasswordResetCode(email, code);

    // Now check if user is admin and needs 2FA
    const { user, profile } = await authService.getCurrentUserProfile();

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Session error", requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const role = isProfileRole(profile?.role) ? profile.role : "customer";
    const isAdmin = isAdminRole(role);

    // If admin, check 2FA status
    if (isAdmin) {
      const { requiresTwoFASetup, requiresTwoFAChallenge } =
        await adminAuthService.getMfaRequirements();

      if (requiresTwoFASetup) {
        // Admin has no 2FA setup - require setup
        return NextResponse.json(
          {
            ok: true,
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
            requiresTwoFAChallenge: true,
            requestId,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
    }

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    logError(error, {
      layer: "auth",
      requestId,
      route: "/api/auth/forgot-password/verify-code",
    });

    const message = error instanceof Error ? error.message : "Invalid or expired code";

    return NextResponse.json(
      {
        ok: false,
        error: message,
        requestId,
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
