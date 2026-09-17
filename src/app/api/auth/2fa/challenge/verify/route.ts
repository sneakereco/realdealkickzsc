// app/api/auth/2fa/challenge/verify/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { setAdminSessionCookie } from "@/lib/http/admin-session-cookie";
import { AdminAuthService } from "@/modules/admin/auth";
import { getRequestIdFromHeaders } from "@/lib/http/request-id";
import { logError } from "@/lib/utils/log";
import { twoFactorChallengeVerifySchema } from "@/lib/validation/auth";

export async function POST(req: NextRequest) {
  const requestId = getRequestIdFromHeaders(req.headers);
  const body = await req.json().catch(() => null);
  const parsed = twoFactorChallengeVerifySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.format(), requestId },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const adminAuthService = new AdminAuthService(supabase);

    const { userId } = await adminAuthService.requireAdminUser();

    // Always choose the enrolled TOTP factor
    const totpFactors = await adminAuthService.listTotpFactors();
    if (totpFactors.length === 0) {
      return NextResponse.json(
        { error: "No enrolled MFA factors", requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const totp = totpFactors[0];

    // Create challenge + verify in the SAME request (prevents IP mismatch)
    const { data: challengeData, error: challengeErr } =
      await adminAuthService.startChallenge(totp.id);

    if (challengeErr || !challengeData) {
      return NextResponse.json(
        { error: challengeErr?.message ?? "Failed to start challenge", requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const cleaned = parsed.data.code.replace(/\D/g, "").slice(0, 6);

    const { error: verifyError } = await adminAuthService.verifyChallenge(
      totp.id,
      challengeData.id,
      cleaned,
    );

    if (verifyError) {
      return NextResponse.json(
        { error: verifyError.message, requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    let res = NextResponse.json<{ ok: true; isAdmin: true }>(
      { ok: true, isAdmin: true },
      { headers: { "Cache-Control": "no-store" } },
    );

    res = await setAdminSessionCookie(res, userId);
    return res;
  } catch (error) {
    logError(error, {
      layer: "auth",
      requestId,
      route: "/api/auth/2fa/challenge/verify",
    });

    const message = error instanceof Error ? error.message : "Auth error";
    const status = message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500;
    const responseError =
      message === "UNAUTHORIZED"
        ? "Unauthorized"
        : message === "FORBIDDEN"
          ? "Forbidden"
          : "Auth error";

    return NextResponse.json(
      { error: responseError, requestId },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
