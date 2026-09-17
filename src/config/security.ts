// src/config/security.ts

const allowLocalSupabaseInProd = true;
const prodConnectSrc = [
  "'self'",
  "https://*.supabase.co",
  "wss://*.supabase.co",
  "https://cloudflareinsights.com",

  // ✅ only when explicitly enabled (for local prod-mode testing)
  ...(allowLocalSupabaseInProd
    ? [
        "https://localhost:*",
        "wss://localhost:*",
        "https://127.0.0.1:*",
        "wss://127.0.0.1:*",
      ]
    : []),
].join(" ");

export const security = {
  proxy: {
    requestIdHeader: "x-request-id",
    botCheckPrefixes: ["/admin", "/api", "/auth", "/products", "/store"],
    rateLimitPrefixes: ["/api", "/store"],
    adminGuard: {
      protectedPrefixes: ["/admin", "/api/admin"],
      exemptPrefixes: ["/api/auth/2fa"],
    },

    canonicalize: {
      redirectStatus: 308,
      lowercasePathname: true,
      collapseMultipleSlashes: true,
      removeTrailingSlash: true,
      maxPathLength: 200,
    },

    bot: {
      blockStatus: 403,
      minUserAgentLength: 8,
      maxLoggedUserAgentLength: 200,

      allowedUserAgents: ["Googlebot", "Applebot", "Bingbot"],

      disallowedUserAgentSubstrings: [
        "curl/",
        "wget/",
        "python-requests",
        "go-http-client",
        "libwww-perl",
        "scrapy",
        "aiohttp",
        "headless",
        "phantom",
        "bot",
        "crawler",
        "spider",
        "scraper",
        "scanner",
        "whatweb",
        "nikto",
        "masscan",
        "nmap",
      ],
    },

    csrf: {
      blockStatus: 403,
      unsafeMethods: ["POST", "PUT", "PATCH", "DELETE"] as const,
      maxOriginLength: 512,

      bypassPrefixes: ["/api/auth/2fa/challenge/verify"],
    },

    rateLimit: {
      store: "upstash",
      enabled: true,
      applyInLocalDev: false,

      blockStatus: 429,
      tooManyRequestsPath: "/too-many-requests",
    },

    admin: {
      loginPath: "/auth/login",
      homePath: "/",
      mfaChallengePath: "/auth/2fa/challenge",
      unauthorizedStatus: 401,
      forbiddenStatus: 403,
      errorStatus: 500,
    },

    adminSession: {
      cookieName: "admin_session",
      ttlSeconds: 60 * 60 * 24,
    },

    securityHeaders: {
      hsts: {
        value: "max-age=63072000; includeSubDomains; preload",
      },

      csp: {
        dev: [
          "default-src 'self'",
          "img-src 'self' data: https: blob:",
          "style-src 'self' 'unsafe-inline'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "worker-src 'self' blob:",
          [
            "connect-src",
            "'self'",
            "ws://localhost:*",
            "http://localhost:*",
            "http://127.0.0.1:*",
            "https:",
          ].join(" "),
          "object-src 'none'",
          "base-uri 'self'",
          "frame-ancestors 'none'",
          "font-src 'self' data:",
          "frame-src 'self' blob: https://www.openstreetmap.org https://*.openstreetmap.org",
          "form-action 'self'",
        ],

        prod: [
          "default-src 'self'",
          "img-src 'self' data: blob: https://*.supabase.co https://*.openstreetmap.org https://*.cloudfront.net https://*.fastly.net",
          "style-src 'self' 'unsafe-inline'",
          "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com/beacon.min.js",
          "worker-src 'self' blob:",
          "object-src 'none'",
          "base-uri 'self'",

          `connect-src ${prodConnectSrc}`,

          "frame-ancestors 'none'",
          "font-src 'self' data:",
          "frame-src 'self' blob: https://www.openstreetmap.org https://*.openstreetmap.org",
          "form-action 'self'",
        ],
      },
    },
  },
} as const;

export function startsWithAny(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

export type CsrfUnsafeMethod = (typeof security.proxy.csrf.unsafeMethods)[number];

export function isCsrfUnsafeMethod(method: string): method is CsrfUnsafeMethod {
  const methodUpper = method.toUpperCase();
  return (security.proxy.csrf.unsafeMethods as readonly string[]).includes(methodUpper);
}
