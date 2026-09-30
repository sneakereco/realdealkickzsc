import { NextRequest } from "next/server";
import { getImageProps } from "next/image";
import { expect, it, vi } from "vitest";

import { POST } from "@/app/api/auth/2fa/enroll/route";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => Promise.resolve({}),
}));
vi.mock("@/modules/admin/auth", () => ({
  AdminAuthService: class {
    requireAdminUser() {
      return Promise.resolve({ userId: "admin" });
    }
    enrollTotp() {
      return Promise.resolve({
        data: {
          id: "pending",
          totp: {
            qr_code:
              'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg">\n</svg>\n',
            uri: "otpauth://totp/test?secret=TEST",
          },
        },
        error: null,
      });
    }
  },
}));
vi.mock("@/lib/utils/log", () => ({ logError: vi.fn() }));

it("returns a desktop QR that clients can render without further normalization", async () => {
  const response = await POST(
    new NextRequest("http://localhost/api/auth/2fa/enroll", { method: "POST" }),
  );
  const result = await response.json();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(() =>
    getImageProps({
      src: result.qrCode,
      alt: "QR",
      width: 192,
      height: 192,
      unoptimized: true,
    }),
  ).not.toThrow();
  expect(result.factorId).toBe("pending");
});

it("preserves mobile setup without sending a QR", async () => {
  const response = await POST(
    new NextRequest("http://localhost/api/auth/2fa/enroll?skipQR=true", {
      method: "POST",
    }),
  );
  expect(await response.json()).toEqual({
    factorId: "pending",
    uri: "otpauth://totp/test?secret=TEST",
  });
});
