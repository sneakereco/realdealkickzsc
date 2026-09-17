// src/config/env.ts
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string(),
  SUPABASE_SECRET_KEY: z.string(),

  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string(),

  ADMIN_SESSION_SECRET: z.string(),

  LIGHTSPEED_ACCESS_TOKEN: z.string().min(1),
  LIGHTSPEED_DOMAIN_PREFIX: z.string().min(1),

  CLOUDFLARE_WEB_ANALYTICS_ENABLED: z.enum(["true", "false"]).default("false"),
  CLOUDFLARE_WEB_ANALYTICS_TOKEN: z.string().trim().min(1).optional(),
});

export const env = schema.parse(process.env);
