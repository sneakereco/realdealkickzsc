// src/lib/supabase/service-role.ts
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/db/database.types";
import { env } from "@/config/env";

export type AdminSupabaseClient = SupabaseClient<Database>;

let adminClient: AdminSupabaseClient | null = null;

export function createSupabaseAdminClient(signal?: AbortSignal): AdminSupabaseClient {
  if (!adminClient || signal) {
    const client = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SECRET_KEY,
      {
        ...(signal
          ? {
              global: {
                fetch: (input: RequestInfo | URL, init?: RequestInit) =>
                  fetch(input, {
                    ...init,
                    signal: AbortSignal.any([
                      signal,
                      AbortSignal.timeout(20_000),
                      ...(init?.signal ? [init.signal] : []),
                    ]),
                  }),
              },
            }
          : {}),
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
    if (signal) return client;
    adminClient = client;
  }

  return adminClient;
}
