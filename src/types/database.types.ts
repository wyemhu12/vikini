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
      admin_audit_logs: {
        Row: {
          action: string
          admin_email: string | null
          admin_id: string
          created_at: string | null
          details: Json | null
          id: string
          target_email: string | null
          target_id: string | null
        }
        Insert: {
          action: string
          admin_email?: string | null
          admin_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_email?: string | null
          target_id?: string | null
        }
        Update: {
          action?: string
          admin_email?: string | null
          admin_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          target_email?: string | null
          target_id?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          forked_from_message_id: string | null
          gem_id: string | null
          id: string
          last_message_preview: string | null
          model: string | null
          parent_conversation_id: string | null
          persona_id: string | null
          project_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          forked_from_message_id?: string | null
          gem_id?: string | null
          id?: string
          last_message_preview?: string | null
          model?: string | null
          parent_conversation_id?: string | null
          persona_id?: string | null
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          forked_from_message_id?: string | null
          gem_id?: string | null
          id?: string
          last_message_preview?: string | null
          model?: string | null
          parent_conversation_id?: string | null
          persona_id?: string | null
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_forked_from_message_id_fkey"
            columns: ["forked_from_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_gem_id_fkey"
            columns: ["gem_id"]
            isOneToOne: false
            referencedRelation: "gems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_parent_conversation_id_fkey"
            columns: ["parent_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_message_counts: {
        Row: {
          count: number
          date: string
          user_id: string
        }
        Insert: {
          count?: number
          date: string
          user_id: string
        }
        Update: {
          count?: number
          date?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_research_counts: {
        Row: {
          count: number
          date: string
          user_id: string
        }
        Insert: {
          count?: number
          date: string
          user_id: string
        }
        Update: {
          count?: number
          date?: string
          user_id?: string
        }
        Relationships: []
      }
      files: {
        Row: {
          bucket: string | null
          conversation_id: string
          created_at: string | null
          expires_at: string | null
          extracted_text: string | null
          filename: string
          gemini_expires_at: string | null
          gemini_file_name: string | null
          gemini_file_uri: string | null
          id: string
          kind: string
          message_id: string | null
          mime_type: string
          size_bytes: number
          storage_path: string | null
          text_extracted_at: string | null
          token_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bucket?: string | null
          conversation_id: string
          created_at?: string | null
          expires_at?: string | null
          extracted_text?: string | null
          filename: string
          gemini_expires_at?: string | null
          gemini_file_name?: string | null
          gemini_file_uri?: string | null
          id?: string
          kind?: string
          message_id?: string | null
          mime_type: string
          size_bytes?: number
          storage_path?: string | null
          text_extracted_at?: string | null
          token_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bucket?: string | null
          conversation_id?: string
          created_at?: string | null
          expires_at?: string | null
          extracted_text?: string | null
          filename?: string
          gemini_expires_at?: string | null
          gemini_file_name?: string | null
          gemini_file_uri?: string | null
          id?: string
          kind?: string
          message_id?: string | null
          mime_type?: string
          size_bytes?: number
          storage_path?: string | null
          text_extracted_at?: string | null
          token_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gem_runs: {
        Row: {
          conversation_id: string | null
          created_at: string
          gem_id: string | null
          id: string
          language: string | null
          system_mode: string | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          gem_id?: string | null
          id?: string
          language?: string | null
          system_mode?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          gem_id?: string | null
          id?: string
          language?: string | null
          system_mode?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gem_runs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gem_runs_gem_id_fkey"
            columns: ["gem_id"]
            isOneToOne: false
            referencedRelation: "gems"
            referencedColumns: ["id"]
          },
        ]
      }
      gem_versions: {
        Row: {
          created_at: string
          created_by: string | null
          gem_id: string
          id: string
          instructions: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          gem_id: string
          id?: string
          instructions: string
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          gem_id?: string
          id?: string
          instructions?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "gem_versions_gem_id_fkey"
            columns: ["gem_id"]
            isOneToOne: false
            referencedRelation: "gems"
            referencedColumns: ["id"]
          },
        ]
      }
      gems: {
        Row: {
          color: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_premade: boolean
          name: string
          slug: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_premade?: boolean
          name: string
          slug?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_premade?: boolean
          name?: string
          slug?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string | null
          document_id: string
          embedding: string | null
          id: string
          metadata: Json | null
          project_id: string
          user_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string | null
          document_id: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          project_id: string
          user_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string | null
          document_id?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          created_at: string | null
          embedding_model: string | null
          error_message: string | null
          filename: string
          id: string
          mime_type: string | null
          project_id: string
          size_bytes: number | null
          status: string | null
          total_chunks: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          embedding_model?: string | null
          error_message?: string | null
          filename: string
          id?: string
          mime_type?: string | null
          project_id: string
          size_bytes?: number | null
          status?: string | null
          total_chunks?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          embedding_model?: string | null
          error_message?: string | null
          filename?: string
          id?: string
          mime_type?: string | null
          project_id?: string
          size_bytes?: number | null
          status?: string | null
          total_chunks?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          meta: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          meta?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          meta?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          color: string | null
          created_at: string | null
          custom_instructions: string | null
          description: string | null
          icon: string | null
          id: string
          is_premade: boolean | null
          name: string
          tone: string | null
          updated_at: string | null
          use_emojis: boolean | null
          use_headers_lists: boolean | null
          user_context: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          custom_instructions?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_premade?: boolean | null
          name: string
          tone?: string | null
          updated_at?: string | null
          use_emojis?: boolean | null
          use_headers_lists?: boolean | null
          user_context?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          custom_instructions?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_premade?: boolean | null
          name?: string
          tone?: string | null
          updated_at?: string | null
          use_emojis?: boolean | null
          use_headers_lists?: boolean | null
          user_context?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_blocked: boolean
          new_id: string | null
          rank: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          is_blocked?: boolean
          new_id?: string | null
          rank?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_blocked?: boolean
          new_id?: string | null
          rank?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          embedding_model: string | null
          icon: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          embedding_model?: string | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          embedding_model?: string | null
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rank_configs: {
        Row: {
          allowed_models: Json
          daily_message_limit: number
          daily_research_limit: number
          features: Json
          max_file_size_mb: number
          rank: string
          updated_at: string
        }
        Insert: {
          allowed_models?: Json
          daily_message_limit: number
          daily_research_limit?: number
          features?: Json
          max_file_size_mb: number
          rank: string
          updated_at?: string
        }
        Update: {
          allowed_models?: Json
          daily_message_limit?: number
          daily_research_limit?: number
          features?: Json
          max_file_size_mb?: number
          rank?: string
          updated_at?: string
        }
        Relationships: []
      }
      research_tasks: {
        Row: {
          agent_model: string
          conversation_id: string | null
          created_at: string | null
          error_message: string | null
          exec_interaction_id: string | null
          gem_id: string | null
          id: string
          plan_interaction_id: string | null
          plan_text: string | null
          project_id: string | null
          query: string
          report_text: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agent_model?: string
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          exec_interaction_id?: string | null
          gem_id?: string | null
          id?: string
          plan_interaction_id?: string | null
          plan_text?: string | null
          project_id?: string | null
          query: string
          report_text?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agent_model?: string
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          exec_interaction_id?: string | null
          gem_id?: string | null
          id?: string
          plan_interaction_id?: string | null
          plan_text?: string | null
          project_id?: string | null
          query?: string
          report_text?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_tasks_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_tasks_gem_id_fkey"
            columns: ["gem_id"]
            isOneToOne: false
            referencedRelation: "gems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_project_storage_bytes: {
        Args: { p_project_id: string }
        Returns: number
      }
      increment_daily_message_count: {
        Args: { p_date: string; p_user_id: string }
        Returns: undefined
      }
      increment_daily_research_count: {
        Args: { p_date: string; p_user_id: string }
        Returns: undefined
      }
      match_project_knowledge: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_project_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          document_id: string
          filename: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
