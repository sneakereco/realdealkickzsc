import { afterEach, expect, it, vi } from "vitest";

import config from "../../next.config";

vi.mock("@/config/env", () => ({ env: {} }));
afterEach(() => vi.unstubAllEnvs());

it.each([
  ["development", "no-store"],
  ["production", "public, max-age=31536000, immutable"],
] as const)("uses appropriate script caching in %s", (mode, expected) => {
  vi.stubEnv("NODE_ENV", mode);
  const rule = config.headers().find((entry) => entry.source === "/_next/static/:path*");
  expect(rule?.headers.find((header) => header.key === "Cache-Control")?.value).toBe(
    expected,
  );
});
