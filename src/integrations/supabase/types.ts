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
      business_profiles: {
        Row: {
          ai_instructions: string | null
          branches: string | null
          business_name: string | null
          business_type: string | null
          common_scenarios: string | null
          complaint_rules: string | null
          created_at: string
          custom_notes: string | null
          description: string | null
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
          updated_at: string
          user_id: string
          verified_facts: string | null
          working_hours: string | null
        }
        Insert: {
          ai_instructions?: string | null
          branches?: string | null
          business_name?: string | null
          business_type?: string | null
          common_scenarios?: string | null
          complaint_rules?: string | null
          created_at?: string
          custom_notes?: string | null
          description?: string | null
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
          updated_at?: string
          user_id: string
          verified_facts?: string | null
          working_hours?: string | null
        }
        Update: {
          ai_instructions?: string | null
          branches?: string | null
          business_name?: string | null
          business_type?: string | null
          common_scenarios?: string | null
          complaint_rules?: string | null
          created_at?: string
          custom_notes?: string | null
          description?: string | null
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
          updated_at?: string
          user_id?: string
          verified_facts?: string | null
          working_hours?: string | null
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
      subscriptions: {
        Row: {
          created_at: string
          id: string
          period_start: string
          plan: Database["public"]["Enums"]["plan_tier"]
          trial_ends_at: string | null
          trial_replies_used: number
          trial_started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_start?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          trial_ends_at?: string | null
          trial_replies_used?: number
          trial_started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          period_start?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          trial_ends_at?: string | null
          trial_replies_used?: number
          trial_started_at?: string | null
          updated_at?: string
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
      get_or_create_subscription: {
        Args: { _user_id: string }
        Returns: {
          created_at: string
          id: string
          period_start: string
          plan: Database["public"]["Enums"]["plan_tier"]
          trial_ends_at: string | null
          trial_replies_used: number
          trial_started_at: string | null
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
