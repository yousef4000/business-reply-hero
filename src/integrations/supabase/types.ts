export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      billing_webhook_events: {
        Row: {
          created_at: string
          event_key: string
          event_name: string | null
          id: string
          processed_at: string
          provider: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_key: string
          event_name?: string | null
          id?: string
          processed_at?: string
          provider: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_key?: string
          event_name?: string | null
          id?: string
          processed_at?: string
          provider?: string
          user_id?: string | null
        }
        Relationships: []
      }
      business_profiles: {
        Row: {
          ai_instructions: string | null
          branches: string | null
          business_dna: Json | null
          business_name: string | null
          business_type: string | null
          common_scenarios: string | null
          complaint_rules: string | null
          created_at: string
          custom_notes: string | null
          description: string | null
          dna_edited_at: string | null
          dna_generated_at: string | null
          escalation_rules: string | null
          faqs: string | null
          forbidden_phrases: string | null
          frequent_questions: string | null
          id: string
          language: string | null
          menu_items: string | null
          never_assume: string | null
          preferred_phrases: string | null
          preferred_tone: string | null
          pricing: string | null
          products: string | null
          return_policy: string | null
          sensitive_cases: string | null
          services: string | null
          shipping_policy: string | null
          social_links: Json | null
          updated_at: string
          user_id: string
          verified_facts: string | null
          website_url: string | null
          working_hours: string | null
        }
        Insert: {
          ai_instructions?: string | null
          branches?: string | null
          business_dna?: Json | null
          business_name?: string | null
          business_type?: string | null
          common_scenarios?: string | null
          complaint_rules?: string | null
          created_at?: string
          custom_notes?: string | null
          description?: string | null
          dna_edited_at?: string | null
          dna_generated_at?: string | null
          escalation_rules?: string | null
          faqs?: string | null
          forbidden_phrases?: string | null
          frequent_questions?: string | null
          id?: string
          language?: string | null
          menu_items?: string | null
          never_assume?: string | null
          preferred_phrases?: string | null
          preferred_tone?: string | null
          pricing?: string | null
          products?: string | null
          return_policy?: string | null
          sensitive_cases?: string | null
          services?: string | null
          shipping_policy?: string | null
          social_links?: Json | null
          updated_at?: string
          user_id: string
          verified_facts?: string | null
          website_url?: string | null
          working_hours?: string | null
        }
        Update: {
          ai_instructions?: string | null
          branches?: string | null
          business_dna?: Json | null
          business_name?: string | null
          business_type?: string | null
          common_scenarios?: string | null
          complaint_rules?: string | null
          created_at?: string
          custom_notes?: string | null
          description?: string | null
          dna_edited_at?: string | null
          dna_generated_at?: string | null
          escalation_rules?: string | null
          faqs?: string | null
          forbidden_phrases?: string | null
          frequent_questions?: string | null
          id?: string
          language?: string | null
          menu_items?: string | null
          never_assume?: string | null
          preferred_phrases?: string | null
          preferred_tone?: string | null
          pricing?: string | null
          products?: string | null
          return_policy?: string | null
          sensitive_cases?: string | null
          services?: string | null
          shipping_policy?: string | null
          social_links?: Json | null
          updated_at?: string
          user_id?: string
          verified_facts?: string | null
          website_url?: string | null
          working_hours?: string | null
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json | null
          source_id: string
          token_estimate: number | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source_id: string
          token_estimate?: number | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source_id?: string
          token_estimate?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_sources: {
        Row: {
          char_count: number | null
          chunk_count: number | null
          created_at: string
          error_message: string | null
          id: string
          original_name: string | null
          raw_text: string | null
          source_type: string
          source_url: string | null
          status: string
          storage_path: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          char_count?: number | null
          chunk_count?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          original_name?: string | null
          raw_text?: string | null
          source_type: string
          source_url?: string | null
          status?: string
          storage_path?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          char_count?: number | null
          chunk_count?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          original_name?: string | null
          raw_text?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          storage_path?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      play_purchases: {
        Row: {
          auto_renewing: boolean | null
          created_at: string
          expiry_time: string | null
          id: string
          order_id: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          platform: string
          product_id: string
          purchase_time: string | null
          purchase_token: string
          raw: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_renewing?: boolean | null
          created_at?: string
          expiry_time?: string | null
          id?: string
          order_id?: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          platform?: string
          product_id: string
          purchase_time?: string | null
          purchase_token: string
          raw?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_renewing?: boolean | null
          created_at?: string
          expiry_time?: string | null
          id?: string
          order_id?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          platform?: string
          product_id?: string
          purchase_time?: string | null
          purchase_token?: string
          raw?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reply_history: {
        Row: {
          business_type: string | null
          category: string | null
          created_at: string
          customer_message: string | null
          goal: string | null
          id: string
          is_favorite: boolean
          objection_type: string | null
          platform: string | null
          reply_text: string
          tone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_type?: string | null
          category?: string | null
          created_at?: string
          customer_message?: string | null
          goal?: string | null
          id?: string
          is_favorite?: boolean
          objection_type?: string | null
          platform?: string | null
          reply_text: string
          tone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_type?: string | null
          category?: string | null
          created_at?: string
          customer_message?: string | null
          goal?: string | null
          id?: string
          is_favorite?: boolean
          objection_type?: string | null
          platform?: string | null
          reply_text?: string
          tone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reply_outcomes: {
        Row: {
          business_type: string | null
          buying_stage: string | null
          created_at: string
          customer_message: string
          embedding: string | null
          id: string
          message_type: string | null
          objection_type: string | null
          outcome: string
          platform: string | null
          purchase_probability: number | null
          reply_style: string | null
          reply_text: string
          tone: string | null
          user_id: string
        }
        Insert: {
          business_type?: string | null
          buying_stage?: string | null
          created_at?: string
          customer_message: string
          embedding?: string | null
          id?: string
          message_type?: string | null
          objection_type?: string | null
          outcome: string
          platform?: string | null
          purchase_probability?: number | null
          reply_style?: string | null
          reply_text: string
          tone?: string | null
          user_id: string
        }
        Update: {
          business_type?: string | null
          buying_stage?: string | null
          created_at?: string
          customer_message?: string
          embedding?: string | null
          id?: string
          message_type?: string | null
          objection_type?: string | null
          outcome?: string
          platform?: string | null
          purchase_probability?: number | null
          reply_style?: string | null
          reply_text?: string
          tone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          customer_portal_url: string | null
          ends_at: string | null
          id: string
          last_event_at: string | null
          period_start: string
          plan: Database["public"]["Enums"]["plan_tier"]
          provider: string | null
          provider_customer_id: string | null
          provider_order_id: string | null
          provider_product_id: string | null
          provider_status: string | null
          provider_subscription_id: string | null
          provider_variant_id: string | null
          renews_at: string | null
          trial_ends_at: string | null
          trial_replies_used: number
          trial_started_at: string | null
          update_payment_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          customer_portal_url?: string | null
          ends_at?: string | null
          id?: string
          last_event_at?: string | null
          period_start?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          provider?: string | null
          provider_customer_id?: string | null
          provider_order_id?: string | null
          provider_product_id?: string | null
          provider_status?: string | null
          provider_subscription_id?: string | null
          provider_variant_id?: string | null
          renews_at?: string | null
          trial_ends_at?: string | null
          trial_replies_used?: number
          trial_started_at?: string | null
          update_payment_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          customer_portal_url?: string | null
          ends_at?: string | null
          id?: string
          last_event_at?: string | null
          period_start?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          provider?: string | null
          provider_customer_id?: string | null
          provider_order_id?: string | null
          provider_product_id?: string | null
          provider_status?: string | null
          provider_subscription_id?: string | null
          provider_variant_id?: string | null
          renews_at?: string | null
          trial_ends_at?: string | null
          trial_replies_used?: number
          trial_started_at?: string | null
          update_payment_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      successful_replies: {
        Row: {
          action: string
          business_type: string | null
          created_at: string
          customer_message: string
          embedding: string | null
          id: string
          intent_tag: string | null
          message_hash: string
          reply_text: string
          updated_at: string
          usage_count: number
          user_id: string
        }
        Insert: {
          action: string
          business_type?: string | null
          created_at?: string
          customer_message: string
          embedding?: string | null
          id?: string
          intent_tag?: string | null
          message_hash: string
          reply_text: string
          updated_at?: string
          usage_count?: number
          user_id: string
        }
        Update: {
          action?: string
          business_type?: string | null
          created_at?: string
          customer_message?: string
          embedding?: string | null
          id?: string
          intent_tag?: string | null
          message_hash?: string
          reply_text?: string
          updated_at?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: []
      }
      usage_counters: {
        Row: {
          created_at: string
          id: string
          period_start: string
          replies_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_start: string
          replies_used?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          period_start?: string
          replies_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_consents: {
        Row: {
          accepted: boolean
          accepted_at: string
          consent_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          accepted?: boolean
          accepted_at?: string
          consent_type: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          accepted?: boolean
          accepted_at?: string
          consent_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      user_style_signals: {
        Row: {
          avg_reply_length: number | null
          avoided_phrases: Json
          created_at: string
          preferred_phrases: Json
          sample_count: number
          tone_hint: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_reply_length?: number | null
          avoided_phrases?: Json
          created_at?: string
          preferred_phrases?: Json
          sample_count?: number
          tone_hint?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_reply_length?: number | null
          avoided_phrases?: Json
          created_at?: string
          preferred_phrases?: Json
          sample_count?: number
          tone_hint?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      winning_replies: {
        Row: {
          created_at: string
          customer_intent: string | null
          customer_message: string | null
          embedding: string | null
          id: string
          industry: string | null
          objection_type: string | null
          reply_text: string
          tags: string[]
          title: string | null
          updated_at: string
          usage_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_intent?: string | null
          customer_message?: string | null
          embedding?: string | null
          id?: string
          industry?: string | null
          objection_type?: string | null
          reply_text: string
          tags?: string[]
          title?: string | null
          updated_at?: string
          usage_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          customer_intent?: string | null
          customer_message?: string | null
          embedding?: string | null
          id?: string
          industry?: string | null
          objection_type?: string | null
          reply_text?: string
          tags?: string[]
          title?: string | null
          updated_at?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_verified_purchase: {
        Args: {
          _auto_renewing: boolean
          _expiry_time: string
          _order_id: string
          _plan: Database["public"]["Enums"]["plan_tier"]
          _product_id: string
          _purchase_time: string
          _purchase_token: string
          _raw: Json
          _user_id: string
        }
        Returns: undefined
      }
      bump_winning_reply_usage: { Args: { _id: string }; Returns: undefined }
      consume_reply_credit: {
        Args: { _user_id: string }
        Returns: {
          period_start: string
          plan: Database["public"]["Enums"]["plan_tier"]
          plan_limit: number
          plan_state: string
          trial_ends_at: string
          trial_limit: number
          trial_used: number
          used: number
        }[]
      }
      delete_user_data: { Args: { _user_id: string }; Returns: undefined }
      get_or_create_subscription: {
        Args: { _user_id: string }
        Returns: {
          cancelled_at: string | null
          created_at: string
          customer_portal_url: string | null
          ends_at: string | null
          id: string
          last_event_at: string | null
          period_start: string
          plan: Database["public"]["Enums"]["plan_tier"]
          provider: string | null
          provider_customer_id: string | null
          provider_order_id: string | null
          provider_product_id: string | null
          provider_status: string | null
          provider_subscription_id: string | null
          provider_variant_id: string | null
          renews_at: string | null
          trial_ends_at: string | null
          trial_replies_used: number
          trial_started_at: string | null
          update_payment_url: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_reply_analytics: { Args: { _user_id: string }; Returns: Json }
      get_usage_status: {
        Args: { _user_id: string }
        Returns: {
          period_start: string
          plan: Database["public"]["Enums"]["plan_tier"]
          plan_limit: number
          plan_state: string
          trial_ends_at: string
          trial_limit: number
          trial_used: number
          used: number
        }[]
      }
      match_knowledge: {
        Args: {
          _match_count?: number
          _query_embedding: string
          _user_id: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
          source_id: string
        }[]
      }
      match_reply_outcomes: {
        Args: {
          _match_count?: number
          _query_embedding: string
          _user_id: string
        }
        Returns: {
          customer_message: string
          id: string
          outcome: string
          reply_style: string
          reply_text: string
          similarity: number
          tone: string
        }[]
      }
      match_successful_replies: {
        Args: {
          _match_count?: number
          _query_embedding: string
          _user_id: string
        }
        Returns: {
          customer_message: string
          id: string
          reply_text: string
          similarity: number
          usage_count: number
        }[]
      }
      match_winning_replies: {
        Args: {
          _match_count?: number
          _query_embedding: string
          _user_id: string
        }
        Returns: {
          customer_intent: string
          customer_message: string
          id: string
          industry: string
          objection_type: string
          reply_text: string
          similarity: number
          title: string
          usage_count: number
        }[]
      }
      my_usage_status: {
        Args: never
        Returns: {
          period_start: string
          plan: Database["public"]["Enums"]["plan_tier"]
          plan_limit: number
          plan_state: string
          trial_ends_at: string
          trial_limit: number
          trial_used: number
          used: number
        }[]
      }
      plan_monthly_limit: {
        Args: { _plan: Database["public"]["Enums"]["plan_tier"] }
        Returns: number
      }
      record_reply_feedback: {
        Args: {
          _action: string
          _business_type?: string
          _customer_message: string
          _embedding?: string
          _intent_tag?: string
          _removed_phrases?: string[]
          _reply_text: string
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      plan_tier: "free" | "starter" | "pro" | "business"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      plan_tier: ["free", "starter", "pro", "business"],
    },
  },
} as const
