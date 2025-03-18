export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      advances: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          date: string
          id: string
          purpose: string
          recipient_name: string
          recipient_type: string
          remarks: string | null
          site_id: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          purpose: string
          recipient_name: string
          recipient_type: string
          remarks?: string | null
          site_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          purpose?: string
          recipient_name?: string
          recipient_type?: string
          remarks?: string | null
          site_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "advances_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advances_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          contact_info: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          contact_info: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          contact_info?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          created_by: string | null
          date: string
          description: string | null
          id: string
          site_id: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          site_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      funds_received: {
        Row: {
          amount: number
          created_at: string
          date: string
          id: string
          method: string | null
          reference: string | null
          site_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          date?: string
          id?: string
          method?: string | null
          reference?: string | null
          site_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          method?: string | null
          reference?: string | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funds_received_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          contractor_id: string | null
          created_at: string | null
          id: string
          invoice_date: string
          status: string
        }
        Insert: {
          amount: number
          contractor_id?: string | null
          created_at?: string | null
          id?: string
          invoice_date?: string
          status?: string
        }
        Update: {
          amount?: number
          contractor_id?: string | null
          created_at?: string | null
          id?: string
          invoice_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          contractor_id: string | null
          created_at: string | null
          id: string
          payment_date: string
          status: string
        }
        Insert: {
          amount: number
          contractor_id?: string | null
          created_at?: string | null
          id?: string
          payment_date?: string
          status?: string
        }
        Update: {
          amount?: number
          contractor_id?: string | null
          created_at?: string | null
          id?: string
          payment_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      site_invoices: {
        Row: {
          approver_type: string | null
          bank_details: Json | null
          bill_url: string | null
          created_at: string
          created_by: string | null
          date: string
          gross_amount: number
          gst_percentage: number
          id: string
          material: string
          material_items: Json | null
          net_amount: number
          party_id: string
          party_name: string
          payment_status: string
          quantity: number
          rate: number
          site_id: string | null
        }
        Insert: {
          approver_type?: string | null
          bank_details?: Json | null
          bill_url?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          gross_amount: number
          gst_percentage: number
          id?: string
          material: string
          material_items?: Json | null
          net_amount: number
          party_id: string
          party_name: string
          payment_status?: string
          quantity: number
          rate: number
          site_id?: string | null
        }
        Update: {
          approver_type?: string | null
          bank_details?: Json | null
          bill_url?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          gross_amount?: number
          gst_percentage?: number
          id?: string
          material?: string
          material_items?: Json | null
          net_amount?: number
          party_id?: string
          party_name?: string
          payment_status?: string
          quantity?: number
          rate?: number
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_invoices_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          completion_date: string | null
          created_at: string | null
          created_by: string | null
          funds: number | null
          id: string
          is_completed: boolean | null
          job_name: string | null
          location: string
          name: string
          pos_no: string | null
          start_date: string | null
          supervisor_id: string | null
          total_funds: number | null
        }
        Insert: {
          completion_date?: string | null
          created_at?: string | null
          created_by?: string | null
          funds?: number | null
          id?: string
          is_completed?: boolean | null
          job_name?: string | null
          location: string
          name: string
          pos_no?: string | null
          start_date?: string | null
          supervisor_id?: string | null
          total_funds?: number | null
        }
        Update: {
          completion_date?: string | null
          created_at?: string | null
          created_by?: string | null
          funds?: number | null
          id?: string
          is_completed?: boolean | null
          job_name?: string | null
          location?: string
          name?: string
          pos_no?: string | null
          start_date?: string | null
          supervisor_id?: string | null
          total_funds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string | null
          role: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name?: string | null
          role: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
