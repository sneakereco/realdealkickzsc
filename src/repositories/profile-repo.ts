// src/repositories/profile-repo.ts
import type { Database } from "@/types/db/database.types";
import type { TypedSupabaseClient } from "@/lib/supabase/server";
import type { ProfileRole } from "@/config/constants/roles";
import { ADMIN_ROLES } from "@/config/constants/roles";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type ProfileAuthView = Pick<
  Profile,
  "id" | "email" | "role" | "full_name" | "tenant_id"
>;

export class ProfileRepository {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  async getByUserId(userId: string): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return data;
  }

  // ✅ Optimized: minimal select for auth
  async getAuthViewByUserId(userId: string): Promise<ProfileAuthView | null> {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("id, email, role, full_name, tenant_id")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return data;
  }

  async ensureProfile(userId: string, email: string, tenantId?: string) {
    // ✅ Use minimal select first
    const { data: existing } = await this.supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (existing) {
      // Profile exists, fetch full data only if needed
      return this.getByUserId(userId);
    }

    let assignedTenantId = tenantId;

    if (!assignedTenantId) {
      const { data: firstTenant, error } = await this.supabase
        .from("tenants")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to query tenants: ${error.message}`);
      }
      if (!firstTenant) {
        throw new Error("No tenant found in database. Please run seed script.");
      }

      assignedTenantId = firstTenant.id;
    }

    const { data, error } = await this.supabase
      .from("profiles")
      .insert({
        id: userId,
        email,
        role: "customer",
        tenant_id: assignedTenantId,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }
    return data;
  }

  async setRole(userId: string, role: ProfileRole) {
    const { error } = await this.supabase
      .from("profiles")
      .update({ role })
      .eq("id", userId);
    if (error) {
      throw error;
    }
  }

  async listStaffProfiles() {
    const { data, error } = await this.supabase
      .from("profiles")
      .select("id, email, role, tenant_id, chat_notifications_enabled")
      .in("role", ADMIN_ROLES as unknown as string[]);

    if (error) {
      throw error;
    }
    return data ?? [];
  }

  async setTenantId(userId: string, tenantId: string) {
    const { error } = await this.supabase
      .from("profiles")
      .update({ tenant_id: tenantId })
      .eq("id", userId);
    if (error) {
      throw error;
    }
  }
}
