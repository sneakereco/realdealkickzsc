import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { QRDisplay } from "@/components/auth/2fa/QRDisplay";
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import { AdminAuthService } from "@/modules/admin/auth";

const pending = {
  id: "pending",
  factor_type: "totp",
  friendly_name: "Admin TOTP",
  status: "unverified",
};

function setup(factors = [pending]) {
  const mfa = {
    listFactors: vi.fn().mockResolvedValue({ data: { all: factors }, error: null }),
    unenroll: vi.fn().mockResolvedValue({ data: {}, error: null }),
    enroll: vi.fn().mockResolvedValue({ data: { id: "new-factor" }, error: null }),
  };
  const service = new AdminAuthService({
    auth: { mfa },
  } as unknown as TypedSupabaseClient);
  return { service, mfa };
}

describe("admin MFA enrollment", () => {
  it("renders a provider SVG with trailing whitespace without crashing", () => {
    const qr =
      'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"></svg>\n';
    const html = renderToStaticMarkup(<QRDisplay qrCode={qr} />);
    expect(html).toContain('alt="2FA QR Code"');
    expect(html).toContain('&lt;/svg&gt;"');
  });

  it("cleans up only the matching pending factor before retrying enrollment", async () => {
    const { service, mfa } = setup([
      pending,
      { ...pending, id: "verified", status: "verified" },
      { ...pending, id: "other-name", friendly_name: "Personal TOTP" },
      { ...pending, id: "other-type", factor_type: "phone" },
    ]);
    expect(await service.enrollTotp()).toEqual({
      data: { id: "new-factor" },
      error: null,
    });
    expect(mfa.unenroll).toHaveBeenCalledExactlyOnceWith({ factorId: "pending" });
    expect(mfa.unenroll.mock.invocationCallOrder[0]).toBeLessThan(
      mfa.enroll.mock.invocationCallOrder[0],
    );
  });

  it("starts a first enrollment without deleting any factors", async () => {
    const { service, mfa } = setup([]);
    expect((await service.enrollTotp()).data?.id).toBe("new-factor");
    expect(mfa.unenroll).not.toHaveBeenCalled();
  });

  it.each(["listFactors", "unenroll"] as const)(
    "stops enrollment when %s fails",
    async (operation) => {
      const { service, mfa } = setup();
      const error = new Error("Provider unavailable");
      mfa[operation].mockResolvedValue({ data: null, error });
      expect(await service.enrollTotp()).toEqual({ data: null, error });
      expect(mfa.enroll).not.toHaveBeenCalled();
      if (operation === "listFactors") expect(mfa.unenroll).not.toHaveBeenCalled();
    },
  );
});
