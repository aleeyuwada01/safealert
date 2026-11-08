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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      alert_acknowledgements: {
        Row: {
          alert_id: string
          created_at: string
          device_hash: string | null
          id: string
          zone_code: string | null
        }
        Insert: {
          alert_id: string
          created_at?: string
          device_hash?: string | null
          id?: string
          zone_code?: string | null
        }
        Update: {
          alert_id?: string
          created_at?: string
          device_hash?: string | null
          id?: string
          zone_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_acknowledgements_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_deliveries: {
        Row: {
          alert_id: string
          channel: Database["public"]["Enums"]["channel_kind"]
          created_at: string
          devices_reached: number
          devices_targeted: number
          error_detail: string | null
          gateway_id: string | null
          gateway_reference: string | null
          id: string
          latency_ms: number | null
          status: Database["public"]["Enums"]["delivery_status"]
          zone_id: string | null
        }
        Insert: {
          alert_id: string
          channel: Database["public"]["Enums"]["channel_kind"]
          created_at?: string
          devices_reached?: number
          devices_targeted?: number
          error_detail?: string | null
          gateway_id?: string | null
          gateway_reference?: string | null
          id?: string
          latency_ms?: number | null
          status?: Database["public"]["Enums"]["delivery_status"]
          zone_id?: string | null
        }
        Update: {
          alert_id?: string
          channel?: Database["public"]["Enums"]["channel_kind"]
          created_at?: string
          devices_reached?: number
          devices_targeted?: number
          error_detail?: string | null
          gateway_id?: string | null
          gateway_reference?: string | null
          id?: string
          latency_ms?: number | null
          status?: Database["public"]["Enums"]["delivery_status"]
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_deliveries_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_deliveries_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "channel_gateways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_deliveries_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_zones: {
        Row: {
          alert_id: string
          zone_id: string
        }
        Insert: {
          alert_id: string
          zone_id: string
        }
        Update: {
          alert_id?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_zones_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_zones_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          effective_at: string
          evacuation_map_url: string | null
          expires_at: string | null
          hazard: Database["public"]["Enums"]["hazard_type"]
          headline: string
          id: string
          instructions: string | null
          issued_at: string
          languages: string[]
          message: string
          severity: Database["public"]["Enums"]["alert_severity"]
          siren_enabled: boolean
          status: Database["public"]["Enums"]["alert_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          effective_at?: string
          evacuation_map_url?: string | null
          expires_at?: string | null
          hazard: Database["public"]["Enums"]["hazard_type"]
          headline: string
          id?: string
          instructions?: string | null
          issued_at?: string
          languages?: string[]
          message: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          siren_enabled?: boolean
          status?: Database["public"]["Enums"]["alert_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          effective_at?: string
          evacuation_map_url?: string | null
          expires_at?: string | null
          hazard?: Database["public"]["Enums"]["hazard_type"]
          headline?: string
          id?: string
          instructions?: string | null
          issued_at?: string
          languages?: string[]
          message?: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          siren_enabled?: boolean
          status?: Database["public"]["Enums"]["alert_status"]
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          alert_id: string | null
          created_at: string
          detail: Json
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          alert_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          alert_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_gateways: {
        Row: {
          channel: Database["public"]["Enums"]["channel_kind"]
          created_at: string
          endpoint: string | null
          health: string
          id: string
          is_active: boolean
          last_heartbeat_at: string | null
          name: string
          operator_name: string | null
          protocol: string
          region: string | null
        }
        Insert: {
          channel: Database["public"]["Enums"]["channel_kind"]
          created_at?: string
          endpoint?: string | null
          health?: string
          id?: string
          is_active?: boolean
          last_heartbeat_at?: string | null
          name: string
          operator_name?: string | null
          protocol: string
          region?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["channel_kind"]
          created_at?: string
          endpoint?: string | null
          health?: string
          id?: string
          is_active?: boolean
          last_heartbeat_at?: string | null
          name?: string
          operator_name?: string | null
          protocol?: string
          region?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agency: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          agency?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          agency?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
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
          role: Database["public"]["Enums"]["app_role"]
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
      zones: {
        Row: {
          centre_lat: number | null
          centre_lng: number | null
          code: string
          created_at: string
          id: string
          name: string
          population_estimate: number
          region: string | null
        }
        Insert: {
          centre_lat?: number | null
          centre_lng?: number | null
          code: string
          created_at?: string
          id?: string
          name: string
          population_estimate?: number
          region?: string | null
        }
        Update: {
          centre_lat?: number | null
          centre_lng?: number | null
          code?: string
          created_at?: string
          id?: string
          name?: string
          population_estimate?: number
          region?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_issue: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      alert_severity: "advisory" | "watch" | "warning" | "extreme"
      alert_status:
        | "draft"
        | "pending_approval"
        | "broadcasting"
        | "live"
        | "expired"
        | "cancelled"
      app_role: "admin" | "operator" | "viewer"
      channel_kind:
        | "cell_broadcast"
        | "sms"
        | "satellite"
        | "wifi_push"
        | "siren"
      delivery_status: "queued" | "dispatched" | "delivered" | "failed"
      hazard_type:
        | "flood"
        | "heatwave"
        | "security_threat"
        | "epidemic"
        | "other"
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
      alert_severity: ["advisory", "watch", "warning", "extreme"],
      alert_status: [
        "draft",
        "pending_approval",
        "broadcasting",
        "live",
        "expired",
        "cancelled",
      ],
      app_role: ["admin", "operator", "viewer"],
      channel_kind: [
        "cell_broadcast",
        "sms",
        "satellite",
        "wifi_push",
        "siren",
      ],
      delivery_status: ["queued", "dispatched", "delivered", "failed"],
      hazard_type: [
        "flood",
        "heatwave",
        "security_threat",
        "epidemic",
        "other",
      ],
    },
  },
} as const
