import Script from "next/script";

import { env } from "@/config/env";

export function CloudflareWebAnalytics() {
  if (env.CLOUDFLARE_WEB_ANALYTICS_ENABLED !== "true") return null;
  if (!env.CLOUDFLARE_WEB_ANALYTICS_TOKEN) {
    throw new Error("Cloudflare Web Analytics is enabled without a site token");
  }

  return (
    <Script
      id="cloudflare-web-analytics"
      type="module"
      strategy="afterInteractive"
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token: env.CLOUDFLARE_WEB_ANALYTICS_TOKEN })}
    />
  );
}
