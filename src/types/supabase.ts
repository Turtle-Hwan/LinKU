export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          nickname: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          nickname?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          nickname?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      publication_likes: {
        Row: {
          created_at: string
          publication_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          publication_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          publication_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_likes_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "template_publications"
            referencedColumns: ["template_id"]
          },
        ]
      }
      template_assets: {
        Row: {
          byte_size: number
          content_hash: string
          created_at: string
          name: string
          object_path: string
          owner_id: string
        }
        Insert: {
          byte_size: number
          content_hash: string
          created_at?: string
          name: string
          object_path: string
          owner_id?: string
        }
        Update: {
          byte_size?: number
          content_hash?: string
          created_at?: string
          name?: string
          object_path?: string
          owner_id?: string
        }
        Relationships: []
      }
      template_publications: {
        Row: {
          author_nickname: string
          clone_count: number
          like_count: number
          owner_id: string
          published_at: string
          revision: number
          snapshot: Json
          source_content_hash: string
          template_id: string
          unpublished_at: string | null
          updated_at: string
        }
        Insert: {
          author_nickname: string
          clone_count?: number
          like_count?: number
          owner_id: string
          published_at?: string
          revision?: number
          snapshot: Json
          source_content_hash: string
          template_id: string
          unpublished_at?: string | null
          updated_at?: string
        }
        Update: {
          author_nickname?: string
          clone_count?: number
          like_count?: number
          owner_id?: string
          published_at?: string
          revision?: number
          snapshot?: Json
          source_content_hash?: string
          template_id?: string
          unpublished_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_publications_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: true
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          content_hash: string
          created_at: string
          deleted_at: string | null
          document: Json
          id: string
          owner_id: string
          revision: number
          updated_at: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          deleted_at?: string | null
          document: Json
          id: string
          owner_id?: string
          revision?: number
          updated_at?: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          deleted_at?: string | null
          document?: Json
          id?: string
          owner_id?: string
          revision?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      browse_publications: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_query?: string
          p_sort?: string
        }
        Returns: {
          author_nickname: string
          clone_count: number
          is_liked: boolean
          like_count: number
          published_at: string
          revision: number
          snapshot: Json
          template_id: string
          updated_at: string
        }[]
      }
      clear_linku_data: { Args: never; Returns: undefined }
      delete_template: {
        Args: { p_expected_revision: number; p_id: string }
        Returns: {
          content_hash: string
          created_at: string
          deleted_at: string | null
          document: Json
          id: string
          owner_id: string
          revision: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      publish_template: {
        Args: { p_expected_revision?: number; p_template_id: string }
        Returns: {
          author_nickname: string
          clone_count: number
          like_count: number
          owner_id: string
          published_at: string
          revision: number
          snapshot: Json
          source_content_hash: string
          template_id: string
          unpublished_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "template_publications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      put_template: {
        Args: {
          p_content_hash: string
          p_document: Json
          p_expected_revision?: number
          p_id: string
        }
        Returns: {
          content_hash: string
          created_at: string
          deleted_at: string | null
          document: Json
          id: string
          owner_id: string
          revision: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_publication_clone: {
        Args: { p_template_id: string }
        Returns: number
      }
      set_publication_liked: {
        Args: { p_liked: boolean; p_template_id: string }
        Returns: number
      }
      unpublish_template: {
        Args: { p_expected_revision: number; p_template_id: string }
        Returns: {
          author_nickname: string
          clone_count: number
          like_count: number
          owner_id: string
          published_at: string
          revision: number
          snapshot: Json
          source_content_hash: string
          template_id: string
          unpublished_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "template_publications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_nickname: {
        Args: { p_nickname: string }
        Returns: {
          created_at: string
          nickname: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
