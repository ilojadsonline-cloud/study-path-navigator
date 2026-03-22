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
      discipline_legal_texts: {
        Row: {
          content: string
          created_at: string
          disciplina: string
          id: number
          lei_nome: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          disciplina: string
          id?: never
          lei_nome: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          disciplina?: string
          id?: never
          lei_nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          id: number
          notification_id: number
          read_at: string
          user_id: string
        }
        Insert: {
          id?: number
          notification_id: number
          read_at?: string
          user_id: string
        }
        Update: {
          id?: number
          notification_id?: number
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          created_by: string
          id: number
          message: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: number
          message: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: number
          message?: string
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cpf: string
          created_at: string
          email: string | null
          id: string
          nome: string
          show_in_ranking: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          cpf: string
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          show_in_ranking?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          cpf?: string
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          show_in_ranking?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      question_reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: number
          motivo: string
          questao_id: number
          resolved_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: number
          motivo?: string
          questao_id: number
          resolved_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: number
          motivo?: string
          questao_id?: number
          resolved_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_reports_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
        ]
      }
      question_reviews: {
        Row: {
          ai_summary: string | null
          created_at: string
          id: number
          issues: Json
          questao_id: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string
          id?: never
          issues?: Json
          questao_id: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          ai_summary?: string | null
          created_at?: string
          id?: never
          issues?: Json
          questao_id?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_reviews_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: true
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
        ]
      }
      questoes: {
        Row: {
          alt_a: string
          alt_b: string
          alt_c: string
          alt_d: string
          alt_e: string
          assunto: string
          comentario: string
          created_at: string
          dificuldade: string
          disciplina: string
          enunciado: string
          gabarito: number
          id: number
        }
        Insert: {
          alt_a: string
          alt_b: string
          alt_c: string
          alt_d: string
          alt_e: string
          assunto: string
          comentario: string
          created_at?: string
          dificuldade?: string
          disciplina: string
          enunciado: string
          gabarito: number
          id?: never
        }
        Update: {
          alt_a?: string
          alt_b?: string
          alt_c?: string
          alt_d?: string
          alt_e?: string
          assunto?: string
          comentario?: string
          created_at?: string
          dificuldade?: string
          disciplina?: string
          enunciado?: string
          gabarito?: number
          id?: never
        }
        Relationships: []
      }
      respostas_usuario: {
        Row: {
          correta: boolean
          created_at: string
          id: number
          questao_id: number
          resposta: number
          user_id: string
        }
        Insert: {
          correta: boolean
          created_at?: string
          id?: never
          questao_id: number
          resposta: number
          user_id: string
        }
        Update: {
          correta?: boolean
          created_at?: string
          id?: never
          questao_id?: number
          resposta?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "respostas_usuario_questao_id_fkey"
            columns: ["questao_id"]
            isOneToOne: false
            referencedRelation: "questoes"
            referencedColumns: ["id"]
          },
        ]
      }
      simulado_progress: {
        Row: {
          created_at: string
          disciplina: string
          id: number
          questao_ids: number[]
          respostas: Json
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          disciplina: string
          id?: never
          questao_ids: number[]
          respostas?: Json
          total: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          disciplina?: string
          id?: never
          questao_ids?: number[]
          respostas?: Json
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      simulados: {
        Row: {
          acertos: number
          created_at: string
          disciplina: string
          finalizado: boolean
          id: number
          questao_ids: number[]
          total: number
          user_id: string
        }
        Insert: {
          acertos?: number
          created_at?: string
          disciplina: string
          finalizado?: boolean
          id?: never
          questao_ids: number[]
          total: number
          user_id: string
        }
        Update: {
          acertos?: number
          created_at?: string
          disciplina?: string
          finalizado?: boolean
          id?: never
          questao_ids?: number[]
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          created_at: string
          duration_seconds: number
          id: number
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          id?: never
          started_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          id?: never
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_cpf_exists: { Args: { p_cpf: string }; Returns: boolean }
      get_email_by_cpf: { Args: { p_cpf: string }; Returns: string }
      get_top10_ranking: {
        Args: never
        Returns: {
          nome: string
          taxa_acertos: number
          total_corretas: number
          total_respondidas: number
          user_id: string
        }[]
      }
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
    },
  },
} as const
