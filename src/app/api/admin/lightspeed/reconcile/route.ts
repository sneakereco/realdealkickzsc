import { NextResponse } from "next/server";

import { AuthError, requireAdminApi } from "@/lib/auth/session";
import {
  loadLightspeedFamilies,
  SupabaseCatalogReconciliationStore,
} from "@/lib/lightspeed/server";
import { reconcileCatalog } from "@/lib/lightspeed/reconciliation";
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
      .from("lightspeed_sync_runs")
      .select("id, status, summary, created_at, completed_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ run: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST() {
  try {
    const session = await requireAdminApi();
    const tenantId = session.profile?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: "Admin tenant is required" }, { status: 400 });
    }
    const supabase = await createSupabaseServerClient();
    const summary = await reconcileCatalog({
      tenantId,
      userId: session.user.id,
      loadFamilies: loadLightspeedFamilies,
      store: new SupabaseCatalogReconciliationStore(supabase),
    });
    return NextResponse.json({ summary }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  logError(error, { layer: "api", endpoint: "/api/admin/lightspeed/reconcile" });
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (
    error instanceof Error &&
    error.message === "lightspeed_reconciliation_already_running"
  ) {
    return NextResponse.json(
      { error: "A Lightspeed sync is already running" },
      { status: 409 },
    );
  }
  return NextResponse.json(
    { error: "Lightspeed reconciliation failed" },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}
