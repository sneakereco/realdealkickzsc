export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string;
          admin_id: string | null;
          created_at: string | null;
          id: string;
          new_value: Json | null;
          old_value: Json | null;
        };
        Insert: {
          action: string;
          admin_id?: string | null;
          created_at?: string | null;
          id?: string;
          new_value?: Json | null;
          old_value?: Json | null;
        };
        Update: {
          action?: string;
          admin_id?: string | null;
          created_at?: string | null;
          id?: string;
          new_value?: Json | null;
          old_value?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_invites: {
        Row: {
          accepted_by: string | null;
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
          role: string;
          token_hash: string;
          used_at: string | null;
        };
        Insert: {
          accepted_by?: string | null;
          created_at?: string;
          created_by: string;
          expires_at: string;
          id?: string;
          role: string;
          token_hash: string;
          used_at?: string | null;
        };
        Update: {
          accepted_by?: string | null;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          role?: string;
          token_hash?: string;
          used_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "admin_invites_accepted_by_fkey";
            columns: ["accepted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_invites_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      admin_notifications: {
        Row: {
          admin_id: string;
          chat_id: string | null;
          created_at: string;
          id: string;
          message: string;
          order_id: string | null;
          read_at: string | null;
          type: string;
        };
        Insert: {
          admin_id: string;
          chat_id?: string | null;
          created_at?: string;
          id?: string;
          message: string;
          order_id?: string | null;
          read_at?: string | null;
          type: string;
        };
        Update: {
          admin_id?: string;
          chat_id?: string | null;
          created_at?: string;
          id?: string;
          message?: string;
          order_id?: string | null;
          read_at?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_notifications_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_notifications_chat_id_fkey";
            columns: ["chat_id"];
            isOneToOne: false;
            referencedRelation: "chats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_notifications_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      catalog_aliases: {
        Row: {
          alias_label: string;
          alias_normalized: string;
          brand_id: string | null;
          created_at: string | null;
          entity_type: string;
          id: string;
          is_active: boolean;
          model_id: string | null;
          priority: number;
          tenant_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          alias_label: string;
          alias_normalized: string;
          brand_id?: string | null;
          created_at?: string | null;
          entity_type: string;
          id?: string;
          is_active?: boolean;
          model_id?: string | null;
          priority?: number;
          tenant_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          alias_label?: string;
          alias_normalized?: string;
          brand_id?: string | null;
          created_at?: string | null;
          entity_type?: string;
          id?: string;
          is_active?: boolean;
          model_id?: string | null;
          priority?: number;
          tenant_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_aliases_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "catalog_brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_aliases_model_id_fkey";
            columns: ["model_id"];
            isOneToOne: false;
            referencedRelation: "catalog_models";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_aliases_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      catalog_brand_groups: {
        Row: {
          created_at: string | null;
          id: string;
          is_active: boolean;
          key: string;
          label: string;
          tenant_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          is_active?: boolean;
          key: string;
          label: string;
          tenant_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          is_active?: boolean;
          key?: string;
          label?: string;
          tenant_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_brand_groups_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      catalog_brands: {
        Row: {
          canonical_label: string;
          created_at: string | null;
          group_id: string;
          id: string;
          is_active: boolean;
          is_verified: boolean;
          tenant_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          canonical_label: string;
          created_at?: string | null;
          group_id: string;
          id?: string;
          is_active?: boolean;
          is_verified?: boolean;
          tenant_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          canonical_label?: string;
          created_at?: string | null;
          group_id?: string;
          id?: string;
          is_active?: boolean;
          is_verified?: boolean;
          tenant_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_brands_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "catalog_brand_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_brands_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      catalog_candidates: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          entity_type: string;
          id: string;
          normalized_text: string;
          parent_brand_id: string | null;
          raw_text: string;
          status: string;
          tenant_id: string;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          entity_type: string;
          id?: string;
          normalized_text: string;
          parent_brand_id?: string | null;
          raw_text: string;
          status?: string;
          tenant_id: string;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          entity_type?: string;
          id?: string;
          normalized_text?: string;
          parent_brand_id?: string | null;
          raw_text?: string;
          status?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_candidates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_candidates_parent_brand_fkey";
            columns: ["parent_brand_id"];
            isOneToOne: false;
            referencedRelation: "catalog_brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_candidates_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      catalog_models: {
        Row: {
          brand_id: string;
          canonical_label: string;
          created_at: string | null;
          id: string;
          is_active: boolean;
          is_verified: boolean;
          tenant_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          brand_id: string;
          canonical_label: string;
          created_at?: string | null;
          id?: string;
          is_active?: boolean;
          is_verified?: boolean;
          tenant_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          brand_id?: string;
          canonical_label?: string;
          created_at?: string | null;
          id?: string;
          is_active?: boolean;
          is_verified?: boolean;
          tenant_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_models_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "catalog_brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_models_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      chargeback_evidence: {
        Row: {
          avs_result_code: string | null;
          billing_address_snapshot: Json | null;
          carrier: string | null;
          created_at: string;
          customer_ip: unknown;
          cvv_result_code: string | null;
          delivery_confirmed_at: string | null;
          delivery_event_snapshot: Json | null;
          device_fingerprint: string | null;
          id: string;
          nofraud_decision: string | null;
          nofraud_transaction_id: string | null;
          order_id: string;
          order_snapshot: Json | null;
          payment_amount: number | null;
          payment_currency: string | null;
          payment_method_last4: string | null;
          payment_method_type: string | null;
          payment_transaction_id: string | null;
          shipping_address_snapshot: Json | null;
          tax_calculation_snapshot: Json | null;
          tenant_id: string;
          tracking_number: string | null;
          updated_at: string;
        };
        Insert: {
          avs_result_code?: string | null;
          billing_address_snapshot?: Json | null;
          carrier?: string | null;
          created_at?: string;
          customer_ip?: unknown;
          cvv_result_code?: string | null;
          delivery_confirmed_at?: string | null;
          delivery_event_snapshot?: Json | null;
          device_fingerprint?: string | null;
          id?: string;
          nofraud_decision?: string | null;
          nofraud_transaction_id?: string | null;
          order_id: string;
          order_snapshot?: Json | null;
          payment_amount?: number | null;
          payment_currency?: string | null;
          payment_method_last4?: string | null;
          payment_method_type?: string | null;
          payment_transaction_id?: string | null;
          shipping_address_snapshot?: Json | null;
          tax_calculation_snapshot?: Json | null;
          tenant_id: string;
          tracking_number?: string | null;
          updated_at?: string;
        };
        Update: {
          avs_result_code?: string | null;
          billing_address_snapshot?: Json | null;
          carrier?: string | null;
          created_at?: string;
          customer_ip?: unknown;
          cvv_result_code?: string | null;
          delivery_confirmed_at?: string | null;
          delivery_event_snapshot?: Json | null;
          device_fingerprint?: string | null;
          id?: string;
          nofraud_decision?: string | null;
          nofraud_transaction_id?: string | null;
          order_id?: string;
          order_snapshot?: Json | null;
          payment_amount?: number | null;
          payment_currency?: string | null;
          payment_method_last4?: string | null;
          payment_method_type?: string | null;
          payment_transaction_id?: string | null;
          shipping_address_snapshot?: Json | null;
          tax_calculation_snapshot?: Json | null;
          tenant_id?: string;
          tracking_number?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chargeback_evidence_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chargeback_evidence_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_messages: {
        Row: {
          body: string;
          chat_id: string;
          created_at: string;
          id: string;
          sender_id: string | null;
          sender_role: string;
        };
        Insert: {
          body: string;
          chat_id: string;
          created_at?: string;
          id?: string;
          sender_id?: string | null;
          sender_role: string;
        };
        Update: {
          body?: string;
          chat_id?: string;
          created_at?: string;
          id?: string;
          sender_id?: string | null;
          sender_role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_chat_id_fkey";
            columns: ["chat_id"];
            isOneToOne: false;
            referencedRelation: "chats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      chats: {
        Row: {
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
          guest_email: string | null;
          id: string;
          order_id: string | null;
          source: string;
          status: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          guest_email?: string | null;
          id?: string;
          order_id?: string | null;
          source?: string;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          guest_email?: string | null;
          id?: string;
          order_id?: string | null;
          source?: string;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "chats_closed_by_fkey";
            columns: ["closed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chats_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chats_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      checkout_api_logs: {
        Row: {
          created_at: string;
          duration_ms: number | null;
          error_message: string | null;
          event_label: string | null;
          http_status: number | null;
          id: string;
          method: string;
          order_id: string | null;
          request_id: string | null;
          request_payload: Json | null;
          response_payload: Json | null;
          route: string;
          tenant_id: string | null;
        };
        Insert: {
          created_at?: string;
          duration_ms?: number | null;
          error_message?: string | null;
          event_label?: string | null;
          http_status?: number | null;
          id?: string;
          method?: string;
          order_id?: string | null;
          request_id?: string | null;
          request_payload?: Json | null;
          response_payload?: Json | null;
          route: string;
          tenant_id?: string | null;
        };
        Update: {
          created_at?: string;
          duration_ms?: number | null;
          error_message?: string | null;
          event_label?: string | null;
          http_status?: number | null;
          id?: string;
          method?: string;
          order_id?: string | null;
          request_id?: string | null;
          request_payload?: Json | null;
          response_payload?: Json | null;
          route?: string;
          tenant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "checkout_api_logs_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_messages: {
        Row: {
          attachments: Json | null;
          created_at: string;
          email: string;
          id: string;
          message: string;
          name: string | null;
          source: string | null;
          subject: string | null;
          user_id: string | null;
        };
        Insert: {
          attachments?: Json | null;
          created_at?: string;
          email: string;
          id?: string;
          message: string;
          name?: string | null;
          source?: string | null;
          subject?: string | null;
          user_id?: string | null;
        };
        Update: {
          attachments?: Json | null;
          created_at?: string;
          email?: string;
          id?: string;
          message?: string;
          name?: string | null;
          source?: string | null;
          subject?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contact_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      email_audit_log: {
        Row: {
          delivered_at: string | null;
          delivery_status: string;
          email_type: string;
          html_snapshot: string | null;
          id: string;
          message_id: string | null;
          opened_at: string | null;
          order_id: string | null;
          plain_text_snapshot: string | null;
          recipient_email: string;
          sent_at: string;
          subject: string | null;
          tenant_id: string;
        };
        Insert: {
          delivered_at?: string | null;
          delivery_status?: string;
          email_type: string;
          html_snapshot?: string | null;
          id?: string;
          message_id?: string | null;
          opened_at?: string | null;
          order_id?: string | null;
          plain_text_snapshot?: string | null;
          recipient_email: string;
          sent_at?: string;
          subject?: string | null;
          tenant_id: string;
        };
        Update: {
          delivered_at?: string | null;
          delivery_status?: string;
          email_type?: string;
          html_snapshot?: string | null;
          id?: string;
          message_id?: string | null;
          opened_at?: string | null;
          order_id?: string | null;
          plain_text_snapshot?: string | null;
          recipient_email?: string;
          sent_at?: string;
          subject?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_audit_log_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_audit_log_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      email_subscribers: {
        Row: {
          email: string;
          id: string;
          source: string | null;
          subscribed_at: string;
        };
        Insert: {
          email: string;
          id?: string;
          source?: string | null;
          subscribed_at?: string;
        };
        Update: {
          email?: string;
          id?: string;
          source?: string | null;
          subscribed_at?: string;
        };
        Relationships: [];
      };
      email_subscription_tokens: {
        Row: {
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          source: string | null;
          token: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          expires_at: string;
          id?: string;
          source?: string | null;
          token: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          source?: string | null;
          token?: string;
        };
        Relationships: [];
      };
      deleted_product_recovery: {
        Row: {
          deleted_at: string;
          deleted_by_user_id: string | null;
          id: string;
          lightspeed_link_snapshots: Json;
          lightspeed_product_snapshots: Json;
          local_product_snapshot: Json;
          metadata: Json;
          product_id: string | null;
          tenant_id: string;
        };
        Insert: {
          deleted_at?: string;
          deleted_by_user_id?: string | null;
          id?: string;
          lightspeed_link_snapshots?: Json;
          lightspeed_product_snapshots?: Json;
          local_product_snapshot?: Json;
          metadata?: Json;
          product_id?: string | null;
          tenant_id: string;
        };
        Update: {
          deleted_at?: string;
          deleted_by_user_id?: string | null;
          id?: string;
          lightspeed_link_snapshots?: Json;
          lightspeed_product_snapshots?: Json;
          local_product_snapshot?: Json;
          metadata?: Json;
          product_id?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deleted_product_recovery_deleted_by_user_id_fkey";
            columns: ["deleted_by_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deleted_product_recovery_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      featured_items: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          product_id: string;
          sort_order: number;
          tenant_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          product_id: string;
          sort_order?: number;
          tenant_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          product_id?: string;
          sort_order?: number;
          tenant_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "featured_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "featured_items_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      lightspeed_product_links: {
        Row: {
          created_at: string;
          external_sku: string;
          id: string;
          last_error: string | null;
          last_lightspeed_modified_at: string | null;
          last_sync_direction: string | null;
          last_website_modified_at: string | null;
          lightspeed_family_id: string | null;
          lightspeed_inventory_item_id: string | null;
          lightspeed_product_id: string | null;
          lightspeed_variant_id: string | null;
          product_id: string | null;
          sync_state: string;
          tenant_id: string;
          tombstoned_at: string | null;
          updated_at: string;
          variant_id: string | null;
        };
        Insert: {
          created_at?: string;
          external_sku: string;
          id?: string;
          last_error?: string | null;
          last_lightspeed_modified_at?: string | null;
          last_sync_direction?: string | null;
          last_website_modified_at?: string | null;
          lightspeed_family_id?: string | null;
          lightspeed_inventory_item_id?: string | null;
          lightspeed_product_id?: string | null;
          lightspeed_variant_id?: string | null;
          product_id?: string | null;
          sync_state?: string;
          tenant_id: string;
          tombstoned_at?: string | null;
          updated_at?: string;
          variant_id?: string | null;
        };
        Update: {
          created_at?: string;
          external_sku?: string;
          id?: string;
          last_error?: string | null;
          last_lightspeed_modified_at?: string | null;
          last_sync_direction?: string | null;
          last_website_modified_at?: string | null;
          lightspeed_family_id?: string | null;
          lightspeed_inventory_item_id?: string | null;
          lightspeed_product_id?: string | null;
          lightspeed_variant_id?: string | null;
          product_id?: string | null;
          sync_state?: string;
          tenant_id?: string;
          tombstoned_at?: string | null;
          updated_at?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lightspeed_product_links_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lightspeed_product_links_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lightspeed_product_links_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      lightspeed_sync_run_items: {
        Row: {
          action: string;
          apply_status: string | null;
          approved: boolean | null;
          change_type: string;
          created_at: string;
          entity_key: string;
          entity_type: string;
          failure_reason: string | null;
          id: string;
          payload: Json;
          sync_run_id: string;
          tenant_id: string;
        };
        Insert: {
          action: string;
          apply_status?: string | null;
          approved?: boolean | null;
          change_type: string;
          created_at?: string;
          entity_key: string;
          entity_type: string;
          failure_reason?: string | null;
          id?: string;
          payload?: Json;
          sync_run_id: string;
          tenant_id: string;
        };
        Update: {
          action?: string;
          apply_status?: string | null;
          approved?: boolean | null;
          change_type?: string;
          created_at?: string;
          entity_key?: string;
          entity_type?: string;
          failure_reason?: string | null;
          id?: string;
          payload?: Json;
          sync_run_id?: string;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lightspeed_sync_run_items_sync_run_id_fkey";
            columns: ["sync_run_id"];
            isOneToOne: false;
            referencedRelation: "lightspeed_sync_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lightspeed_sync_run_items_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      lightspeed_sync_runs: {
        Row: {
          completed_at: string | null;
          created_at: string;
          id: string;
          source_of_truth: string;
          started_by: string | null;
          status: string;
          summary: Json;
          tenant_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          source_of_truth: string;
          started_by?: string | null;
          status?: string;
          summary?: Json;
          tenant_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          source_of_truth?: string;
          started_by?: string | null;
          status?: string;
          summary?: Json;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lightspeed_sync_runs_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      lightspeed_webhook_events: {
        Row: {
          attempts: number;
          created_at: string;
          event_id: string;
          id: string;
          last_error: string | null;
          lease_until: string | null;
          next_attempt_at: string;
          outcome: Json | null;
          payload: Json;
          processed_at: string | null;
          resource_id: string | null;
          resource_version: number | null;
          state: string;
          tenant_id: string | null;
          topic: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          event_id: string;
          id?: string;
          last_error?: string | null;
          lease_until?: string | null;
          next_attempt_at?: string;
          outcome?: Json | null;
          payload: Json;
          processed_at?: string | null;
          resource_id?: string | null;
          resource_version?: number | null;
          state?: string;
          tenant_id?: string | null;
          topic: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          event_id?: string;
          id?: string;
          last_error?: string | null;
          lease_until?: string | null;
          next_attempt_at?: string;
          outcome?: Json | null;
          payload?: Json;
          processed_at?: string | null;
          resource_id?: string | null;
          resource_version?: number | null;
          state?: string;
          tenant_id?: string | null;
          topic?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lightspeed_webhook_events_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      nexus_registrations: {
        Row: {
          created_at: string;
          id: string;
          is_registered: boolean;
          registered_at: string | null;
          registration_type: string;
          state_code: string;
          tenant_id: string;
          tracking_started_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_registered?: boolean;
          registered_at?: string | null;
          registration_type: string;
          state_code: string;
          tenant_id: string;
          tracking_started_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_registered?: boolean;
          registered_at?: string | null;
          registration_type?: string;
          state_code?: string;
          tenant_id?: string;
          tracking_started_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nexus_registrations_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      order_access_tokens: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          last_used_at: string | null;
          order_id: string;
          token_hash: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          id?: string;
          last_used_at?: string | null;
          order_id: string;
          token_hash: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          last_used_at?: string | null;
          order_id?: string;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_access_tokens_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_billing: {
        Row: {
          city: string | null;
          country: string | null;
          created_at: string | null;
          id: string;
          line1: string | null;
          line2: string | null;
          name: string | null;
          order_id: string;
          phone: string | null;
          postal_code: string | null;
          state: string | null;
        };
        Insert: {
          city?: string | null;
          country?: string | null;
          created_at?: string | null;
          id?: string;
          line1?: string | null;
          line2?: string | null;
          name?: string | null;
          order_id: string;
          phone?: string | null;
          postal_code?: string | null;
          state?: string | null;
        };
        Update: {
          city?: string | null;
          country?: string | null;
          created_at?: string | null;
          id?: string;
          line1?: string | null;
          line2?: string | null;
          name?: string | null;
          order_id?: string;
          phone?: string | null;
          postal_code?: string | null;
          state?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_billing_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_events: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          message: string | null;
          order_id: string;
          type: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          message?: string | null;
          order_id: string;
          type: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          message?: string | null;
          order_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_events_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          brand: string | null;
          category: string | null;
          condition: string | null;
          created_at: string | null;
          id: string;
          line_total: number;
          model: string | null;
          order_id: string;
          product_id: string | null;
          product_name: string | null;
          quantity: number;
          refund_amount: number | null;
          refunded_at: string | null;
          size_label: string | null;
          unit_cost: number | null;
          unit_price: number;
          variant_id: string | null;
          variant_sku: string | null;
        };
        Insert: {
          brand?: string | null;
          category?: string | null;
          condition?: string | null;
          created_at?: string | null;
          id?: string;
          line_total: number;
          model?: string | null;
          order_id: string;
          product_id?: string | null;
          product_name?: string | null;
          quantity: number;
          refund_amount?: number | null;
          refunded_at?: string | null;
          size_label?: string | null;
          unit_cost?: number | null;
          unit_price: number;
          variant_id?: string | null;
          variant_sku?: string | null;
        };
        Update: {
          brand?: string | null;
          category?: string | null;
          condition?: string | null;
          created_at?: string | null;
          id?: string;
          line_total?: number;
          model?: string | null;
          order_id?: string;
          product_id?: string | null;
          product_name?: string | null;
          quantity?: number;
          refund_amount?: number | null;
          refunded_at?: string | null;
          size_label?: string | null;
          unit_cost?: number | null;
          unit_price?: number;
          variant_id?: string | null;
          variant_sku?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      order_shipping: {
        Row: {
          city: string | null;
          country: string | null;
          created_at: string | null;
          id: string;
          line1: string | null;
          line2: string | null;
          name: string | null;
          order_id: string;
          phone: string | null;
          postal_code: string | null;
          state: string | null;
        };
        Insert: {
          city?: string | null;
          country?: string | null;
          created_at?: string | null;
          id?: string;
          line1?: string | null;
          line2?: string | null;
          name?: string | null;
          order_id: string;
          phone?: string | null;
          postal_code?: string | null;
          state?: string | null;
        };
        Update: {
          city?: string | null;
          country?: string | null;
          created_at?: string | null;
          id?: string;
          line1?: string | null;
          line2?: string | null;
          name?: string | null;
          order_id?: string;
          phone?: string | null;
          postal_code?: string | null;
          state?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_shipping_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          actual_shipping_cost_cents: number | null;
          cart_hash: string | null;
          created_at: string | null;
          currency: string | null;
          customer_state: string | null;
          expires_at: string | null;
          failure_reason: string | null;
          fee: number | null;
          fulfillment: string | null;
          fulfillment_status: string | null;
          guest_email: string | null;
          id: string;
          idempotency_key: string | null;
          label_created_at: string | null;
          label_created_by: string | null;
          label_url: string | null;
          nofraud_decision: string | null;
          nofraud_transaction_id: string | null;
          payment_transaction_id: string | null;
          payrilla_transaction_id: string | null;
          pickup_instructions: string | null;
          pickup_location_id: string | null;
          public_token: string | null;
          refund_amount: number | null;
          refunded_at: string | null;
          seller_id: string | null;
          shipped_at: string | null;
          shipping: number;
          shipping_carrier: string | null;
          status: string | null;
          stripe_session_id: string | null;
          subtotal: number;
          tax_amount: number | null;
          tax_calculation_id: string | null;
          tax_transaction_id: string | null;
          tenant_id: string | null;
          total: number;
          tracking_number: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          actual_shipping_cost_cents?: number | null;
          cart_hash?: string | null;
          created_at?: string | null;
          currency?: string | null;
          customer_state?: string | null;
          expires_at?: string | null;
          failure_reason?: string | null;
          fee?: number | null;
          fulfillment?: string | null;
          fulfillment_status?: string | null;
          guest_email?: string | null;
          id?: string;
          idempotency_key?: string | null;
          label_created_at?: string | null;
          label_created_by?: string | null;
          label_url?: string | null;
          nofraud_decision?: string | null;
          nofraud_transaction_id?: string | null;
          payment_transaction_id?: string | null;
          payrilla_transaction_id?: string | null;
          pickup_instructions?: string | null;
          pickup_location_id?: string | null;
          public_token?: string | null;
          refund_amount?: number | null;
          refunded_at?: string | null;
          seller_id?: string | null;
          shipped_at?: string | null;
          shipping: number;
          shipping_carrier?: string | null;
          status?: string | null;
          stripe_session_id?: string | null;
          subtotal: number;
          tax_amount?: number | null;
          tax_calculation_id?: string | null;
          tax_transaction_id?: string | null;
          tenant_id?: string | null;
          total: number;
          tracking_number?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          actual_shipping_cost_cents?: number | null;
          cart_hash?: string | null;
          created_at?: string | null;
          currency?: string | null;
          customer_state?: string | null;
          expires_at?: string | null;
          failure_reason?: string | null;
          fee?: number | null;
          fulfillment?: string | null;
          fulfillment_status?: string | null;
          guest_email?: string | null;
          id?: string;
          idempotency_key?: string | null;
          label_created_at?: string | null;
          label_created_by?: string | null;
          label_url?: string | null;
          nofraud_decision?: string | null;
          nofraud_transaction_id?: string | null;
          payment_transaction_id?: string | null;
          payrilla_transaction_id?: string | null;
          pickup_instructions?: string | null;
          pickup_location_id?: string | null;
          public_token?: string | null;
          refund_amount?: number | null;
          refunded_at?: string | null;
          seller_id?: string | null;
          shipped_at?: string | null;
          shipping?: number;
          shipping_carrier?: string | null;
          status?: string | null;
          stripe_session_id?: string | null;
          subtotal?: number;
          tax_amount?: number | null;
          tax_calculation_id?: string | null;
          tax_transaction_id?: string | null;
          tenant_id?: string | null;
          total?: number;
          tracking_number?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_label_created_by_fkey";
            columns: ["label_created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_seller_id_fkey";
            columns: ["seller_id"];
            isOneToOne: false;
            referencedRelation: "sellers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_events: {
        Row: {
          created_at: string;
          event_data: Json;
          event_type: string;
          id: string;
          order_id: string;
          payment_transaction_id: string;
          tenant_id: string | null;
        };
        Insert: {
          created_at?: string;
          event_data?: Json;
          event_type: string;
          id?: string;
          order_id: string;
          payment_transaction_id: string;
          tenant_id?: string | null;
        };
        Update: {
          created_at?: string;
          event_data?: Json;
          event_type?: string;
          id?: string;
          order_id?: string;
          payment_transaction_id?: string;
          tenant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payment_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_events_payment_transaction_id_fkey";
            columns: ["payment_transaction_id"];
            isOneToOne: false;
            referencedRelation: "payment_transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_events_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_transactions: {
        Row: {
          amount_authorized: number | null;
          amount_captured: number | null;
          amount_refunded: number;
          amount_requested: number;
          avs_result_code: string | null;
          billing_address: string | null;
          billing_city: string | null;
          billing_country: string | null;
          billing_name: string | null;
          billing_phone: string | null;
          billing_state: string | null;
          billing_zip: string | null;
          card_bin: string | null;
          card_expiry_month: number | null;
          card_expiry_year: number | null;
          card_last4: string | null;
          card_type: string | null;
          created_at: string;
          currency: string;
          customer_email: string | null;
          customer_ip: string | null;
          cvv2_result_code: string | null;
          id: string;
          nofraud_decision: string | null;
          nofraud_transaction_id: string | null;
          order_id: string;
          payrilla_auth_code: string | null;
          payrilla_reference_number: number | null;
          payrilla_status: string;
          tenant_id: string | null;
          three_ds_eci: string | null;
          three_ds_status: string | null;
          updated_at: string;
        };
        Insert: {
          amount_authorized?: number | null;
          amount_captured?: number | null;
          amount_refunded?: number;
          amount_requested: number;
          avs_result_code?: string | null;
          billing_address?: string | null;
          billing_city?: string | null;
          billing_country?: string | null;
          billing_name?: string | null;
          billing_phone?: string | null;
          billing_state?: string | null;
          billing_zip?: string | null;
          card_bin?: string | null;
          card_expiry_month?: number | null;
          card_expiry_year?: number | null;
          card_last4?: string | null;
          card_type?: string | null;
          created_at?: string;
          currency?: string;
          customer_email?: string | null;
          customer_ip?: string | null;
          cvv2_result_code?: string | null;
          id?: string;
          nofraud_decision?: string | null;
          nofraud_transaction_id?: string | null;
          order_id: string;
          payrilla_auth_code?: string | null;
          payrilla_reference_number?: number | null;
          payrilla_status?: string;
          tenant_id?: string | null;
          three_ds_eci?: string | null;
          three_ds_status?: string | null;
          updated_at?: string;
        };
        Update: {
          amount_authorized?: number | null;
          amount_captured?: number | null;
          amount_refunded?: number;
          amount_requested?: number;
          avs_result_code?: string | null;
          billing_address?: string | null;
          billing_city?: string | null;
          billing_country?: string | null;
          billing_name?: string | null;
          billing_phone?: string | null;
          billing_state?: string | null;
          billing_zip?: string | null;
          card_bin?: string | null;
          card_expiry_month?: number | null;
          card_expiry_year?: number | null;
          card_last4?: string | null;
          card_type?: string | null;
          created_at?: string;
          currency?: string;
          customer_email?: string | null;
          customer_ip?: string | null;
          cvv2_result_code?: string | null;
          id?: string;
          nofraud_decision?: string | null;
          nofraud_transaction_id?: string | null;
          order_id?: string;
          payrilla_auth_code?: string | null;
          payrilla_reference_number?: number | null;
          payrilla_status?: string;
          tenant_id?: string | null;
          three_ds_eci?: string | null;
          three_ds_status?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_transactions_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_transactions_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_webhook_events: {
        Row: {
          created: number;
          id: string;
          order_id: string | null;
          payload_hash: string;
          processed_at: string | null;
          type: string;
          webhook_event_id: string;
        };
        Insert: {
          created: number;
          id?: string;
          order_id?: string | null;
          payload_hash: string;
          processed_at?: string | null;
          type: string;
          webhook_event_id: string;
        };
        Update: {
          created?: number;
          id?: string;
          order_id?: string | null;
          payload_hash?: string;
          processed_at?: string | null;
          type?: string;
          webhook_event_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stripe_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      payout_settings: {
        Row: {
          account_label: string | null;
          account_last4: string | null;
          created_at: string;
          id: string;
          primary_admin_id: string;
          provider: string | null;
          updated_at: string;
        };
        Insert: {
          account_label?: string | null;
          account_last4?: string | null;
          created_at?: string;
          id?: string;
          primary_admin_id: string;
          provider?: string | null;
          updated_at?: string;
        };
        Update: {
          account_label?: string | null;
          account_last4?: string | null;
          created_at?: string;
          id?: string;
          primary_admin_id?: string;
          provider?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payout_settings_primary_admin_id_fkey";
            columns: ["primary_admin_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: {
          id: string;
          is_primary: boolean;
          product_id: string;
          sort_order: number;
          url: string;
        };
        Insert: {
          id?: string;
          is_primary?: boolean;
          product_id: string;
          sort_order?: number;
          url: string;
        };
        Update: {
          id?: string;
          is_primary?: boolean;
          product_id?: string;
          sort_order?: number;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_tags: {
        Row: {
          product_id: string;
          tag_id: string;
        };
        Insert: {
          product_id: string;
          tag_id: string;
        };
        Update: {
          product_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_tags_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          created_at: string;
          id: string;
          product_id: string;
          sale_price_cents: number;
          size_label: string;
          sku: string;
          sort_order: number;
          stock: number;
          tenant_id: string;
          unit_cost_cents: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          product_id: string;
          sale_price_cents: number;
          size_label: string;
          sku: string;
          sort_order?: number;
          stock?: number;
          tenant_id: string;
          unit_cost_cents?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          product_id?: string;
          sale_price_cents?: number;
          size_label?: string;
          sku?: string;
          sort_order?: number;
          stock?: number;
          tenant_id?: string;
          unit_cost_cents?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_variants_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          archived_at: string | null;
          brand: string;
          category: string;
          condition: string;
          created_at: string;
          description: string | null;
          excluded_auto_tag_keys: string[];
          go_live_at: string;
          id: string;
          is_active: boolean;
          is_out_of_stock: boolean;
          model: string | null;
          name: string;
          product_created_at: string;
          product_updated_at: string;
          shipping_price_cents: number | null;
          size_type: string;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          brand: string;
          category: string;
          condition: string;
          created_at?: string;
          description?: string | null;
          excluded_auto_tag_keys?: string[];
          go_live_at?: string;
          id?: string;
          is_active?: boolean;
          is_out_of_stock?: boolean;
          model?: string | null;
          name: string;
          product_created_at?: string;
          product_updated_at?: string;
          shipping_price_cents?: number | null;
          size_type?: string;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          brand?: string;
          category?: string;
          condition?: string;
          created_at?: string;
          description?: string | null;
          excluded_auto_tag_keys?: string[];
          go_live_at?: string;
          id?: string;
          is_active?: boolean;
          is_out_of_stock?: boolean;
          model?: string | null;
          name?: string;
          product_created_at?: string;
          product_updated_at?: string;
          shipping_price_cents?: number | null;
          size_type?: string;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          admin_order_notifications_enabled: boolean;
          chat_notifications_enabled: boolean;
          created_at: string | null;
          email: string | null;
          full_name: string | null;
          id: string;
          is_primary_admin: boolean;
          payrilla_account_id: string | null;
          payrilla_customer_token: string | null;
          role: string | null;
          stripe_customer_id: string | null;
          tenant_id: string | null;
        };
        Insert: {
          admin_order_notifications_enabled?: boolean;
          chat_notifications_enabled?: boolean;
          created_at?: string | null;
          email?: string | null;
          full_name?: string | null;
          id: string;
          is_primary_admin?: boolean;
          payrilla_account_id?: string | null;
          payrilla_customer_token?: string | null;
          role?: string | null;
          stripe_customer_id?: string | null;
          tenant_id?: string | null;
        };
        Update: {
          admin_order_notifications_enabled?: boolean;
          chat_notifications_enabled?: boolean;
          created_at?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          is_primary_admin?: boolean;
          payrilla_account_id?: string | null;
          payrilla_customer_token?: string | null;
          role?: string | null;
          stripe_customer_id?: string | null;
          tenant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      sellers: {
        Row: {
          created_at: string | null;
          id: string;
          name: string;
          tenant_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          name: string;
          tenant_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          name?: string;
          tenant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sellers_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      shipping_carriers: {
        Row: {
          created_at: string;
          enabled_carriers: string[];
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          enabled_carriers?: string[];
          id?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          enabled_carriers?: string[];
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shipping_defaults: {
        Row: {
          category: string;
          created_at: string | null;
          default_height_in: number;
          default_length_in: number;
          default_weight_oz: number;
          default_width_in: number;
          id: string;
          shipping_cost_cents: number;
          tenant_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          category: string;
          created_at?: string | null;
          default_height_in: number;
          default_length_in: number;
          default_weight_oz: number;
          default_width_in: number;
          id?: string;
          shipping_cost_cents?: number;
          tenant_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          category?: string;
          created_at?: string | null;
          default_height_in?: number;
          default_length_in?: number;
          default_weight_oz?: number;
          default_width_in?: number;
          id?: string;
          shipping_cost_cents?: number;
          tenant_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      shipping_origins: {
        Row: {
          city: string;
          company: string | null;
          country: string;
          created_at: string;
          id: string;
          line1: string;
          line2: string | null;
          name: string;
          phone: string | null;
          postal_code: string;
          state: string;
          updated_at: string;
        };
        Insert: {
          city: string;
          company?: string | null;
          country: string;
          created_at?: string;
          id?: string;
          line1: string;
          line2?: string | null;
          name: string;
          phone?: string | null;
          postal_code: string;
          state: string;
          updated_at?: string;
        };
        Update: {
          city?: string;
          company?: string | null;
          country?: string;
          created_at?: string;
          id?: string;
          line1?: string;
          line2?: string | null;
          name?: string;
          phone?: string | null;
          postal_code?: string;
          state?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shipping_profiles: {
        Row: {
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          country: string | null;
          full_name: string | null;
          phone: string | null;
          postal_code: string | null;
          state: string | null;
          tenant_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          country?: string | null;
          full_name?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          state?: string | null;
          tenant_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          country?: string | null;
          full_name?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          state?: string | null;
          tenant_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shipping_profiles_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      shipping_tracking_events: {
        Row: {
          carrier: string;
          description: string | null;
          event_timestamp: string;
          id: string;
          location: string | null;
          order_id: string;
          raw_carrier_response: Json | null;
          recorded_at: string;
          status: string;
          tenant_id: string;
          tracking_number: string;
        };
        Insert: {
          carrier: string;
          description?: string | null;
          event_timestamp: string;
          id?: string;
          location?: string | null;
          order_id: string;
          raw_carrier_response?: Json | null;
          recorded_at?: string;
          status: string;
          tenant_id: string;
          tracking_number: string;
        };
        Update: {
          carrier?: string;
          description?: string | null;
          event_timestamp?: string;
          id?: string;
          location?: string | null;
          order_id?: string;
          raw_carrier_response?: Json | null;
          recorded_at?: string;
          status?: string;
          tenant_id?: string;
          tracking_number?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shipping_tracking_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shipping_tracking_events_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      site_pageviews: {
        Row: {
          created_at: string;
          id: string;
          path: string;
          referrer: string | null;
          session_id: string;
          user_id: string | null;
          visitor_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          path: string;
          referrer?: string | null;
          session_id: string;
          user_id?: string | null;
          visitor_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          path?: string;
          referrer?: string | null;
          session_id?: string;
          user_id?: string | null;
          visitor_id?: string;
        };
        Relationships: [];
      };
      state_sales_tracking: {
        Row: {
          created_at: string;
          id: string;
          month: number;
          state_code: string;
          tax_collected: number;
          taxable_sales: number;
          tenant_id: string;
          total_sales: number;
          transaction_count: number;
          updated_at: string;
          year: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          month: number;
          state_code: string;
          tax_collected?: number;
          taxable_sales?: number;
          tenant_id: string;
          total_sales?: number;
          transaction_count?: number;
          updated_at?: string;
          year: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          month?: number;
          state_code?: string;
          tax_collected?: number;
          taxable_sales?: number;
          tenant_id?: string;
          total_sales?: number;
          transaction_count?: number;
          updated_at?: string;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: "state_sales_tracking_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tags: {
        Row: {
          group_key: string;
          id: string;
          label: string;
          tenant_id: string | null;
        };
        Insert: {
          group_key: string;
          id?: string;
          label: string;
          tenant_id?: string | null;
        };
        Update: {
          group_key?: string;
          id?: string;
          label?: string;
          tenant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tags_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tax_rate_cache: {
        Row: {
          breakdown: Json | null;
          cached_at: string;
          city_rate: number | null;
          combined_rate: number;
          county_rate: number | null;
          district_rate: number | null;
          expires_at: string;
          id: string;
          state_code: string | null;
          state_rate: number | null;
          zip_code: string;
        };
        Insert: {
          breakdown?: Json | null;
          cached_at?: string;
          city_rate?: number | null;
          combined_rate: number;
          county_rate?: number | null;
          district_rate?: number | null;
          expires_at?: string;
          id?: string;
          state_code?: string | null;
          state_rate?: number | null;
          zip_code: string;
        };
        Update: {
          breakdown?: Json | null;
          cached_at?: string;
          city_rate?: number | null;
          combined_rate?: number;
          county_rate?: number | null;
          district_rate?: number | null;
          expires_at?: string;
          id?: string;
          state_code?: string | null;
          state_rate?: number | null;
          zip_code?: string;
        };
        Relationships: [];
      };
      tenant_lightspeed_settings: {
        Row: {
          access_token: string | null;
          account_id: string | null;
          created_at: string;
          domain_prefix: string | null;
          id: string;
          refresh_token: string | null;
          retailer_id: string | null;
          sync_enabled: boolean;
          tenant_id: string;
          token_expires_at: string | null;
          updated_at: string;
          webhook_secret: string | null;
        };
        Insert: {
          access_token?: string | null;
          account_id?: string | null;
          created_at?: string;
          domain_prefix?: string | null;
          id?: string;
          refresh_token?: string | null;
          retailer_id?: string | null;
          sync_enabled?: boolean;
          tenant_id: string;
          token_expires_at?: string | null;
          updated_at?: string;
          webhook_secret?: string | null;
        };
        Update: {
          access_token?: string | null;
          account_id?: string | null;
          created_at?: string;
          domain_prefix?: string | null;
          id?: string;
          refresh_token?: string | null;
          retailer_id?: string | null;
          sync_enabled?: boolean;
          tenant_id?: string;
          token_expires_at?: string | null;
          updated_at?: string;
          webhook_secret?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_lightspeed_settings_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_payrilla_credentials: {
        Row: {
          api_key_encrypted: string;
          created_at: string;
          id: string;
          is_active: boolean;
          payrilla_merchant_id: string | null;
          tenant_id: string;
          tokenization_key_encrypted: string;
          updated_at: string;
        };
        Insert: {
          api_key_encrypted: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          payrilla_merchant_id?: string | null;
          tenant_id: string;
          tokenization_key_encrypted: string;
          updated_at?: string;
        };
        Update: {
          api_key_encrypted?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          payrilla_merchant_id?: string | null;
          tenant_id?: string;
          tokenization_key_encrypted?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_payrilla_credentials_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_store_access_settings: {
        Row: {
          checkout_lock_enabled: boolean;
          checkout_lock_message: string;
          created_at: string;
          id: string;
          site_lock_enabled: boolean;
          site_unlock_at: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          checkout_lock_enabled?: boolean;
          checkout_lock_message?: string;
          created_at?: string;
          id?: string;
          site_lock_enabled?: boolean;
          site_unlock_at?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          checkout_lock_enabled?: boolean;
          checkout_lock_message?: string;
          created_at?: string;
          id?: string;
          site_lock_enabled?: boolean;
          site_unlock_at?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_store_access_settings_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenant_tax_settings: {
        Row: {
          business_name: string | null;
          created_at: string;
          home_state: string;
          id: string;
          tax_code_overrides: Json;
          tax_enabled: boolean;
          tax_id_number: string | null;
          tenant_id: string;
          updated_at: string;
        };
        Insert: {
          business_name?: string | null;
          created_at?: string;
          home_state: string;
          id?: string;
          tax_code_overrides?: Json;
          tax_enabled?: boolean;
          tax_id_number?: string | null;
          tenant_id: string;
          updated_at?: string;
        };
        Update: {
          business_name?: string | null;
          created_at?: string;
          home_state?: string;
          id?: string;
          tax_code_overrides?: Json;
          tax_enabled?: boolean;
          tax_id_number?: string | null;
          tenant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tenant_tax_settings_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: true;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenants: {
        Row: {
          created_at: string | null;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      transaction_audit_log: {
        Row: {
          actor: string;
          created_at: string;
          data: Json | null;
          event_type: string;
          id: string;
          ip_address: unknown;
          order_id: string | null;
          tenant_id: string;
          user_agent: string | null;
        };
        Insert: {
          actor: string;
          created_at?: string;
          data?: Json | null;
          event_type: string;
          id?: string;
          ip_address?: unknown;
          order_id?: string | null;
          tenant_id: string;
          user_agent?: string | null;
        };
        Update: {
          actor?: string;
          created_at?: string;
          data?: Json | null;
          event_type?: string;
          id?: string;
          ip_address?: unknown;
          order_id?: string | null;
          tenant_id?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "transaction_audit_log_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transaction_audit_log_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      user_addresses: {
        Row: {
          city: string | null;
          country: string | null;
          created_at: string | null;
          id: string;
          is_default: boolean | null;
          line1: string | null;
          line2: string | null;
          name: string | null;
          phone: string | null;
          postal_code: string | null;
          state: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          city?: string | null;
          country?: string | null;
          created_at?: string | null;
          id?: string;
          is_default?: boolean | null;
          line1?: string | null;
          line2?: string | null;
          name?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          state?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          city?: string | null;
          country?: string | null;
          created_at?: string | null;
          id?: string;
          is_default?: boolean | null;
          line1?: string | null;
          line2?: string | null;
          name?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          state?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_billing_addresses: {
        Row: {
          city: string | null;
          country: string | null;
          created_at: string | null;
          id: string;
          is_default: boolean | null;
          line1: string | null;
          line2: string | null;
          name: string | null;
          phone: string | null;
          postal_code: string | null;
          state: string | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          city?: string | null;
          country?: string | null;
          created_at?: string | null;
          id?: string;
          is_default?: boolean | null;
          line1?: string | null;
          line2?: string | null;
          name?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          state?: string | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          city?: string | null;
          country?: string | null;
          created_at?: string | null;
          id?: string;
          is_default?: boolean | null;
          line1?: string | null;
          line2?: string | null;
          name?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          state?: string | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      decrement_variant_stock: {
        Args: { p_quantity: number; p_variant_id: string };
        Returns: undefined;
      };
      increment_variant_stock: {
        Args: { p_quantity: number; p_variant_id: string };
        Returns: undefined;
      };
      is_admin: { Args: never; Returns: boolean };
      is_admin_for_tenant: { Args: { target_tenant: string }; Returns: boolean };
      is_dev: { Args: never; Returns: boolean };
      is_super_admin: { Args: never; Returns: boolean };
      mark_order_paid_and_decrement: {
        Args: {
          p_items: Json;
          p_order_id: string;
          p_stripe_payment_intent_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
