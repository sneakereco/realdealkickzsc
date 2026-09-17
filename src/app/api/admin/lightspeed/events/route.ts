import { NextResponse } from "next/server";

import { AuthError, requireAdminApi } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logError } from "@/lib/utils/log";

export async function GET() {
  try {
    const session = await requireAdminApi();
    const tenantId = session.profile?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: "Admin tenant is required" }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("lightspeed_webhook_events")
      .select(
        "id, event_id, topic, state, attempts, outcome, last_error, created_at, processed_at",
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return NextResponse.json(
      { events: data ?? [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logError(error, { layer: "api", endpoint: "GET /api/admin/lightspeed/events" });
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to load webhook events" }, { status: 500 });
  }
}
