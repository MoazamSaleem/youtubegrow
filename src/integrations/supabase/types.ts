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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_credits_usage: {
        Row: {
          created_at: string
          credits_used: number
          id: string
          query_complexity: string
          query_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_used: number
          id?: string
          query_complexity: string
          query_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_used?: number
          id?: string
          query_complexity?: string
          query_type?: string
          user_id?: string
        }
        Relationships: []
      }
      growth_tasks: {
        Row: {
          category: string
          created_at: string
          description: string | null
          difficulty: string
          id: string
          is_recurring: boolean
          order_index: number
          recurrence_days: number | null
          reset_frequency: string | null
          tier: string
          title: string
          token_reward: number
          xp_reward: number
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          difficulty?: string
          id?: string
          is_recurring?: boolean
          order_index?: number
          recurrence_days?: number | null
          reset_frequency?: string | null
          tier?: string
          title: string
          token_reward?: number
          xp_reward?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          difficulty?: string
          id?: string
          is_recurring?: boolean
          order_index?: number
          recurrence_days?: number | null
          reset_frequency?: string | null
          tier?: string
          title?: string
          token_reward?: number
          xp_reward?: number
        }
        Relationships: []
      }
      milestones: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          order_index: number
          required_xp: number
          tier: string
          title: string
          token_reward: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          order_index?: number
          required_xp: number
          tier?: string
          title: string
          token_reward?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          order_index?: number
          required_xp?: number
          tier?: string
          title?: string
          token_reward?: number
        }
        Relationships: []
      }
      perks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          perk_type: string
          perk_value: Json | null
          token_cost: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          perk_type: string
          perk_value?: Json | null
          token_cost: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          perk_type?: string
          perk_value?: Json | null
          token_cost?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_task_completions: {
        Row: {
          completed_at: string
          id: string
          period_end: string
          period_start: string
          task_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          period_end: string
          period_start: string
          task_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          period_end?: string
          period_start?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "growth_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_cycle?: string
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_tracking: {
        Row: {
          channel_analyses: number | null
          competitor_analyses: number | null
          created_at: string
          date: string
          id: string
          keywords_used: number | null
          scripts_generated: number | null
          thumbnails_generated: number | null
          topics_generated: number | null
          user_id: string
        }
        Insert: {
          channel_analyses?: number | null
          competitor_analyses?: number | null
          created_at?: string
          date?: string
          id?: string
          keywords_used?: number | null
          scripts_generated?: number | null
          thumbnails_generated?: number | null
          topics_generated?: number | null
          user_id: string
        }
        Update: {
          channel_analyses?: number | null
          competitor_analyses?: number | null
          created_at?: string
          date?: string
          id?: string
          keywords_used?: number | null
          scripts_generated?: number | null
          thumbnails_generated?: number | null
          topics_generated?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_milestones: {
        Row: {
          claimed: boolean
          claimed_at: string | null
          id: string
          milestone_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          claimed?: boolean
          claimed_at?: string | null
          id?: string
          milestone_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          claimed?: boolean
          claimed_at?: string | null
          id?: string
          milestone_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_milestones_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      user_perks: {
        Row: {
          expires_at: string | null
          id: string
          perk_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          id?: string
          perk_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          id?: string
          perk_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_perks_perk_id_fkey"
            columns: ["perk_id"]
            isOneToOne: false
            referencedRelation: "perks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_task_progress: {
        Row: {
          completed_at: string | null
          completion_count: number
          created_at: string
          id: string
          last_completed_at: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completion_count?: number
          created_at?: string
          id?: string
          last_completed_at?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completion_count?: number
          created_at?: string
          id?: string
          last_completed_at?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_task_progress_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "growth_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tokens: {
        Row: {
          ai_credits_balance: number
          ai_credits_used: number
          balance: number
          created_at: string
          current_xp: number
          display_name: string | null
          id: string
          show_on_leaderboard: boolean
          total_earned: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_credits_balance?: number
          ai_credits_used?: number
          balance?: number
          created_at?: string
          current_xp?: number
          display_name?: string | null
          id?: string
          show_on_leaderboard?: boolean
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_credits_balance?: number
          ai_credits_used?: number
          balance?: number
          created_at?: string
          current_xp?: number
          display_name?: string | null
          id?: string
          show_on_leaderboard?: boolean
          total_earned?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      youtube_channels: {
        Row: {
          channel_id: string
          channel_name: string | null
          channel_url: string | null
          created_at: string
          id: string
          is_primary: boolean | null
          subscriber_count: number | null
          thumbnail_url: string | null
          updated_at: string
          user_id: string
          video_count: number | null
          view_count: number | null
        }
        Insert: {
          channel_id: string
          channel_name?: string | null
          channel_url?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean | null
          subscriber_count?: number | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
          video_count?: number | null
          view_count?: number | null
        }
        Update: {
          channel_id?: string
          channel_name?: string | null
          channel_url?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean | null
          subscriber_count?: number | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
          video_count?: number | null
          view_count?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      leaderboard: {
        Row: {
          avatar_url: string | null
          current_xp: number | null
          display_name: string | null
          token_balance: number | null
          tokens_earned: number | null
          tokens_rank: number | null
          user_id: string | null
          xp_rank: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      subscription_plan: "free" | "basic" | "pro" | "advanced"
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
      app_role: ["admin", "moderator", "user"],
      subscription_plan: ["free", "basic", "pro", "advanced"],
    },
  },
} as const
