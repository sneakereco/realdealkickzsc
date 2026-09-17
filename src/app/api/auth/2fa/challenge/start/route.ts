// app/api/auth/2fa/challenge/start/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminAuthService } from "@/modules/admin/auth";
import { getRequestIdFromHeaders } from "@/lib/http/request-id";
import { logError } from "@/lib/utils/log";

export async function POST(request: NextRequest) {
  const requestId = getRequestIdFromHeaders(request.headers);

  try {
    const supabase = await createSupabaseServerClient();
    const adminAuthService = new AdminAuthService(supabase);

    await adminAuthService.requireAdminUser();

    const totpFactors = await adminAuthService.listTotpFactors();

    if (totpFactors.length === 0) {
      return NextResponse.json(
        { error: "No enrolled MFA factors", requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const totp = totpFactors[0];

    const { data: challengeData, error: challengeErr } =
      await adminAuthService.startChallenge(totp.id);

    if (challengeErr || !challengeData) {
      return NextResponse.json(
        { error: challengeErr?.message ?? "Failed to start challenge", requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        factorId: totp.id,
        challengeId: challengeData.id,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logError(error, {
      layer: "auth",
      requestId,
      route: "/api/auth/2fa/challenge/start",
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
