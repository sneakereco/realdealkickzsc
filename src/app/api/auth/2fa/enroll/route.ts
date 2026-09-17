// app/api/auth/2fa/enroll/route.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminAuthService } from "@/modules/admin/auth";
import { getRequestIdFromHeaders } from "@/lib/http/request-id";
import { logError } from "@/lib/utils/log";

export async function POST(req: NextRequest) {
  const requestId = getRequestIdFromHeaders(req.headers);

  // Check if client wants to skip QR (mobile)
  const { searchParams } = new URL(req.url);
  const skipQR = searchParams.get("skipQR") === "true";

  try {
    const supabase = await createSupabaseServerClient();
    const adminAuthService = new AdminAuthService(supabase);

    await adminAuthService.requireAdminUser();

    const { data, error } = await adminAuthService.enrollTotp();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to start MFA enrollment", requestId },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { id: factorId, totp } = data;

    // For mobile, only send the URI (smaller payload)
    if (skipQR) {
      return NextResponse.json(
        {
          factorId,
          uri: totp.uri,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    // For desktop, send both QR and URI
    return NextResponse.json(
      {
        factorId,
        qrCode: totp.qr_code,
        uri: totp.uri,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logError(error, {
      layer: "auth",
      requestId,
      route: "/api/auth/2fa/enroll",
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
