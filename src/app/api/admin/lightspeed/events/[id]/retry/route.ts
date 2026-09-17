import { NextResponse } from "next/server";

import { AuthError, requireAdminApi } from "@/lib/auth/session";
import { processLightspeedWebhookEvent } from "@/modules/lightspeed/webhook-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logError } from "@/lib/utils/log";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAdminApi();
    const tenantId = session.profile?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: "Admin tenant is required" }, { status: 400 });
    }
    const { id } = await context.params;
    const supabase = await createSupabaseServerClient();
    const owned = await supabase
      .from("lightspeed_webhook_events")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (owned.error) throw owned.error;
    if (!owned.data) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const event = await processLightspeedWebhookEvent(id);
    return NextResponse.json({ event });
  } catch (error) {
    logError(error, {
      layer: "api",
      endpoint: "POST /api/admin/lightspeed/events/:id/retry",
    });
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to retry webhook event" }, { status: 500 });
  }
}
