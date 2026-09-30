import { afterEach, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/config/env", () => ({
  env: { LIGHTSPEED_DOMAIN_PREFIX: "test-store", LIGHTSPEED_ACCESS_TOKEN: "test-token" },
}));

import { loadLightspeedFamilies } from "@/modules/lightspeed/server";

afterEach(() => vi.unstubAllGlobals());

test("loads families after an empty final page without version metadata", async () => {
  vi.stubGlobal("fetch", (input: string) => {
    const url = new URL(input);
    if (url.pathname.endsWith("/products")) {
      switch (url.searchParams.get("after")) {
        case "0":
          return Promise.resolve(
            Response.json({
              data: [{ id: "product-1", family_id: "family-1", version: 10 }],
              version: { min: 10, max: 10 },
            }),
          );
        case "10":
          return Promise.resolve(Response.json({ data: [] }));
      }
    }
    if (url.pathname.endsWith("/product_families/family-1")) {
      return Promise.resolve(
        Response.json({ data: { id: "family-1", products: [{ id: "product-1" }] } }),
      );
    }
    if (url.pathname.endsWith("/inventory")) {
      return Promise.resolve(
        Response.json([{ product_id: "product-1", current_inventory_level: 2 }]),
      );
    }
    throw new Error("Unexpected request");
  });

  const progress: unknown[] = [];
  await expect(
    loadLightspeedFamilies((value) => {
      progress.push(value);
      return Promise.resolve();
    }),
  ).resolves.toEqual([
    {
      data: { id: "family-1", products: [{ id: "product-1" }] },
      inventory: [{ product_id: "product-1", current_inventory_level: 2 }],
    },
  ]);
  expect(progress).toEqual([
    { phase: "listing", completed: 1, total: null },
    { phase: "downloading", completed: 0, total: 1 },
    { phase: "downloading", completed: 1, total: 1 },
  ]);
});

test("aborts a stalled provider request after 30 seconds", async () => {
  const controller = new AbortController();
  const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
  vi.stubGlobal(
    "fetch",
    (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        queueMicrotask(() =>
          controller.abort(new DOMException("Timed out", "TimeoutError")),
        );
      }),
  );
  try {
    await expect(loadLightspeedFamilies()).rejects.toThrow("lightspeed_request_timeout");
    expect(timeout).toHaveBeenCalledWith(30_000);
  } finally {
    timeout.mockRestore();
  }
});

test("accepts an empty catalog without version metadata", async () => {
  vi.stubGlobal("fetch", () => Promise.resolve(Response.json({ data: [] })));
  await expect(loadLightspeedFamilies()).resolves.toEqual([]);
});

test("reports a timeout while reading the response body", async () => {
  const controller = new AbortController();
  const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
  vi.stubGlobal("fetch", () =>
    Promise.resolve({
      ok: true,
      json: () => {
        controller.abort(new DOMException("Timed out", "TimeoutError"));
        return Promise.reject(new DOMException("Aborted", "AbortError"));
      },
    }),
  );
  try {
    await expect(loadLightspeedFamilies()).rejects.toThrow("lightspeed_request_timeout");
  } finally {
    timeout.mockRestore();
  }
});

test.each([undefined, { max: null }, { max: 0 }, { max: -1 }, { max: "10" }])(
  "rejects a populated page with invalid cursor %j",
  async (version) => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        Response.json({
          data: [{ id: "product-1", family_id: "family-1", version: 10 }],
          version,
        }),
      ),
    );
    await expect(loadLightspeedFamilies()).rejects.toThrow();
  },
);
