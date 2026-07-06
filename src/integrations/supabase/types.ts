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
      ai_provider_attempts: {
        Row: {
          attempt_index: number
          created_at: string
          duration_ms: number | null
          error_message: string | null
          fallback_reason: string | null
          generation_job_id: string | null
          id: string
          input_tokens: number | null
          metadata: Json | null
          model: string
          output_tokens: number | null
          provider: string
          question_id: number | null
          routing_mode: string | null
          stage: string
          success: boolean
        }
        Insert: {
          attempt_index?: number
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          fallback_reason?: string | null
          generation_job_id?: string | null
          id?: string
          input_tokens?: number | null
          metadata?: Json | null
          model: string
          output_tokens?: number | null
          provider: string
          question_id?: number | null
          routing_mode?: string | null
          stage: string
          success?: boolean
        }
        Update: {
          attempt_index?: number
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          fallback_reason?: string | null
          generation_job_id?: string | null
          id?: string
          input_tokens?: number | null
          metadata?: Json | null
          model?: string
          output_tokens?: number | null
          provider?: string
          question_id?: number | null
          routing_mode?: string | null
          stage?: string
          success?: boolean
        }
        Relationships: []
      }
      audit_jobs: {
        Row: {
          auto_fixed: number
          created_at: string
          errors: number
          flagged: number
          id: string
          last_error: string | null
          processed: number
          scope: Json
          status: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_fixed?: number
          created_at?: string
          errors?: number
          flagged?: number
          id?: string
          last_error?: string | null
          processed?: number
          scope?: Json
          status?: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_fixed?: number
          created_at?: string
          errors?: number
          flagged?: number
          id?: string
          last_error?: string | null
          processed?: number
          scope?: Json
          status?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bizuaulas_videos: {
        Row: {
          created_at: string
          disciplina_id: string
          id: string
          ordem: number
          titulo: string
          updated_at: string
          url_youtube: string
        }
        Insert: {
          created_at?: string
          disciplina_id: string
          id?: string
          ordem?: number
          titulo: string
          updated_at?: string
          url_youtube: string
        }
        Update: {
          created_at?: string
          disciplina_id?: string
          id?: string
          ordem?: number
          titulo?: string
          updated_at?: string
          url_youtube?: string
        }
        Relationships: []
      }
      cronogramas: {
        Row: {
          atividades: Json
          ativo: boolean
          created_at: string
          dias_semana: string[]
          distribuicao: Json
          horario_fim: string
          horario_inicio: string
          horas_semanais: number
          id: string
          nome: string
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          atividades?: Json
          ativo?: boolean
          created_at?: string
          dias_semana?: string[]
          distribuicao?: Json
          horario_fim?: string
          horario_inicio?: string
          horas_semanais?: number
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          atividades?: Json
          ativo?: boolean
          created_at?: string
          dias_semana?: string[]
          distribuicao?: Json
          horario_fim?: string
          horario_inicio?: string
          horas_semanais?: number
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
      generation_jobs: {
        Row: {
          batch_size: number
          batches_done: number
          batches_per_discipline: number
          batches_results: Json
          batches_total: number
          created_at: string
          disciplines: Json
          id: string
          status: string
          total_generated: number
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_size?: number
          batches_done?: number
          batches_per_discipline?: number
          batches_results?: Json
          batches_total?: number
          created_at?: string
          disciplines?: Json
          id?: string
          status?: string
          total_generated?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_size?: number
          batches_done?: number
          batches_per_discipline?: number
          batches_results?: Json
          batches_total?: number
          created_at?: string
          disciplines?: Json
          id?: string
          status?: string
          total_generated?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mapas_mentais: {
        Row: {
          created_at: string
          disciplina_id: string
          id: string
          nome_arquivo: string
          storage_path: string
          topico: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          disciplina_id: string
          id?: string
          nome_arquivo: string
          storage_path: string
          topico: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          disciplina_id?: string
          id?: string
          nome_arquivo?: string
          storage_path?: string
          topico?: string
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
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: number
          message: string
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: number
          message?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          action_taken: string | null
          amount: number | null
          created_at: string
          email: string | null
          gateway: string
          id: string
          payment_id: string | null
          payment_type: string | null
          processed_at: string
          raw_payload: Json | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          action_taken?: string | null
          amount?: number | null
          created_at?: string
          email?: string | null
          gateway?: string
          id?: string
          payment_id?: string | null
          payment_type?: string | null
          processed_at?: string
          raw_payload?: Json | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          action_taken?: string | null
          amount?: number | null
          created_at?: string
          email?: string | null
          gateway?: string
          id?: string
          payment_id?: string | null
          payment_type?: string | null
          processed_at?: string
          raw_payload?: Json | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pop_access: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      pop_allowlist: {
        Row: {
          cpf: string | null
          created_at: string
          id: string
          matricula: string | null
          nome_completo: string | null
          rg: string | null
          updated_at: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          id?: string
          matricula?: string | null
          nome_completo?: string | null
          rg?: string | null
          updated_at?: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          id?: string
          matricula?: string | null
          nome_completo?: string | null
          rg?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cpf: string
          created_at: string
          email: string | null
          id: string
          last_seen_at: string | null
          nome: string
          show_in_ranking: boolean
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cpf: string
          created_at?: string
          email?: string | null
          id?: string
          last_seen_at?: string | null
          nome: string
          show_in_ranking?: boolean
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cpf?: string
          created_at?: string
          email?: string | null
          id?: string
          last_seen_at?: string | null
          nome?: string
          show_in_ranking?: boolean
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      question_audits: {
        Row: {
          ai_summary: string | null
          applied_patch: Json | null
          audited_by_ai: boolean
          confidence: number | null
          created_at: string
          id: number
          issues: Json
          proposed_patch: Json | null
          questao_id: number
          reviewed_at: string | null
          reviewed_by: string | null
          risk_level: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          applied_patch?: Json | null
          audited_by_ai?: boolean
          confidence?: number | null
          created_at?: string
          id?: number
          issues?: Json
          proposed_patch?: Json | null
          questao_id: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          applied_patch?: Json | null
          audited_by_ai?: boolean
          confidence?: number | null
          created_at?: string
          id?: number
          issues?: Json
          proposed_patch?: Json | null
          questao_id?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_level?: string | null
          status?: string
          updated_at?: string
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
      question_versions: {
        Row: {
          audit_id: number | null
          change_reason: string | null
          changed_by: string | null
          created_at: string
          id: number
          questao_id: number
          snapshot: Json
          version_number: number
        }
        Insert: {
          audit_id?: number | null
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          id?: number
          questao_id: number
          snapshot: Json
          version_number?: number
        }
        Update: {
          audit_id?: number | null
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          id?: number
          questao_id?: number
          snapshot?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_versions_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "question_audits"
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
          ano: number | null
          artigo_principal: string | null
          assinatura_semantica: Json | null
          assunto: string
          audit_status: string
          audit_status_updated_at: string
          audit_techniques: Json
          banca: string | null
          cognitive_skill: string | null
          comentario: string
          created_at: string
          difficulty_level: string | null
          dificuldade: string
          disciplina: string
          enunciado: string
          enunciado_imagem_nome: string | null
          enunciado_imagem_path: string | null
          gabarito: number
          id: number
          origem: string | null
          prova: string | null
          trap_type: string | null
        }
        Insert: {
          alt_a: string
          alt_b: string
          alt_c: string
          alt_d: string
          alt_e: string
          ano?: number | null
          artigo_principal?: string | null
          assinatura_semantica?: Json | null
          assunto: string
          audit_status?: string
          audit_status_updated_at?: string
          audit_techniques?: Json
          banca?: string | null
          cognitive_skill?: string | null
          comentario: string
          created_at?: string
          difficulty_level?: string | null
          dificuldade?: string
          disciplina: string
          enunciado: string
          enunciado_imagem_nome?: string | null
          enunciado_imagem_path?: string | null
          gabarito: number
          id?: never
          origem?: string | null
          prova?: string | null
          trap_type?: string | null
        }
        Update: {
          alt_a?: string
          alt_b?: string
          alt_c?: string
          alt_d?: string
          alt_e?: string
          ano?: number | null
          artigo_principal?: string | null
          assinatura_semantica?: Json | null
          assunto?: string
          audit_status?: string
          audit_status_updated_at?: string
          audit_techniques?: Json
          banca?: string | null
          cognitive_skill?: string | null
          comentario?: string
          created_at?: string
          difficulty_level?: string | null
          dificuldade?: string
          disciplina?: string
          enunciado?: string
          enunciado_imagem_nome?: string | null
          enunciado_imagem_path?: string | null
          gabarito?: number
          id?: never
          origem?: string | null
          prova?: string | null
          trap_type?: string | null
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
      simulado_semanal_questoes: {
        Row: {
          alt_a: string
          alt_b: string
          alt_c: string
          alt_d: string
          alt_e: string
          anulada: boolean
          assunto: string | null
          comentario: string | null
          created_at: string
          dificuldade: string
          disciplina: string
          enunciado: string
          gabarito: number
          id: string
          ordem: number
          simulado_id: string
        }
        Insert: {
          alt_a: string
          alt_b: string
          alt_c: string
          alt_d: string
          alt_e: string
          anulada?: boolean
          assunto?: string | null
          comentario?: string | null
          created_at?: string
          dificuldade?: string
          disciplina: string
          enunciado: string
          gabarito: number
          id?: string
          ordem: number
          simulado_id: string
        }
        Update: {
          alt_a?: string
          alt_b?: string
          alt_c?: string
          alt_d?: string
          alt_e?: string
          anulada?: boolean
          assunto?: string | null
          comentario?: string | null
          created_at?: string
          dificuldade?: string
          disciplina?: string
          enunciado?: string
          gabarito?: number
          id?: string
          ordem?: number
          simulado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulado_semanal_questoes_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados_semanais"
            referencedColumns: ["id"]
          },
        ]
      }
      simulado_semanal_tentativas: {
        Row: {
          acertos: number
          created_at: string
          finished_at: string | null
          id: string
          pontuacao: number
          respostas: Json
          simulado_id: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          acertos?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          pontuacao?: number
          respostas?: Json
          simulado_id: string
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          acertos?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          pontuacao?: number
          respostas?: Json
          simulado_id?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulado_semanal_tentativas_simulado_id_fkey"
            columns: ["simulado_id"]
            isOneToOne: false
            referencedRelation: "simulados_semanais"
            referencedColumns: ["id"]
          },
        ]
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
      simulados_semanais: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          descricao: string | null
          duracao_minutos: number
          ends_at: string
          id: string
          starts_at: string
          titulo: string
          total_questoes: number
          valor_questao: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          duracao_minutos?: number
          ends_at: string
          id?: string
          starts_at?: string
          titulo: string
          total_questoes?: number
          valor_questao?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          duracao_minutos?: number
          ends_at?: string
          id?: string
          starts_at?: string
          titulo?: string
          total_questoes?: number
          valor_questao?: number
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
      trial_usage: {
        Row: {
          converted_to_paid: boolean
          cpf: string | null
          created_at: string
          email: string
          id: string
          provider: string
          stripe_customer_id: string | null
          trial_ends_at: string | null
          trial_started_at: string
          user_id: string | null
        }
        Insert: {
          converted_to_paid?: boolean
          cpf?: string | null
          created_at?: string
          email: string
          id?: string
          provider?: string
          stripe_customer_id?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string
          user_id?: string | null
        }
        Update: {
          converted_to_paid?: boolean
          cpf?: string | null
          created_at?: string
          email?: string
          id?: string
          provider?: string
          stripe_customer_id?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string
          user_id?: string | null
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
      dedup_disciplina_preview: {
        Args: {
          p_disciplina: string
          p_threshold_alts?: number
          p_threshold_enun?: number
        }
        Returns: {
          dup_enun: string
          dup_id: number
          keep_enun: string
          keep_id: number
          sim_alts: number
          sim_enun: number
        }[]
      }
      dedup_questoes: {
        Args: {
          p_dry_run?: boolean
          p_threshold_alts?: number
          p_threshold_enun?: number
        }
        Returns: {
          disciplina: string
          kept_enun: string
          kept_id: number
          removed_enun: string
          removed_id: number
          sim_alts: number
          sim_enun: number
        }[]
      }
      excluir_questoes_por_ids: { Args: { p_ids: number[] }; Returns: number }
      get_desempenho_disciplinas: {
        Args: { p_user_id?: string }
        Returns: {
          corretas: number
          disciplina: string
          total: number
        }[]
      }
      get_email_by_cpf: { Args: { p_cpf: string }; Returns: string }
      get_my_ranking_position: {
        Args: { p_period?: string }
        Returns: {
          rank: number
          taxa_acertos: number
          total_corretas: number
          total_respondidas: number
        }[]
      }
      get_my_trial_status: {
        Args: never
        Returns: {
          converted_to_paid: boolean
          has_trial: boolean
          trial_ends_at: string
        }[]
      }
      get_ranking: {
        Args: { p_period?: string }
        Returns: {
          nome: string
          taxa_acertos: number
          total_corretas: number
          total_respondidas: number
          user_id: string
        }[]
      }
      get_simulado_semanal_ranking: {
        Args: { p_simulado_id: string }
        Returns: {
          acertos: number
          duracao_segundos: number
          finished_at: string
          nome: string
          pontuacao: number
          posicao: number
          situacao: string
          total: number
          user_id: string
        }[]
      }
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
      has_pop_access: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_used_trial: {
        Args: { p_cpf?: string; p_email: string }
        Returns: boolean
      }
      list_disciplinas: {
        Args: never
        Returns: {
          disciplina: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
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
