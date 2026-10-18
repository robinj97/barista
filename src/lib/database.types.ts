// Generated from the Supabase project with the generate_typescript_types tool.
// Do not edit by hand: regenerate after every schema change. The generic helper types
// (Tables, TablesInsert, ...) that the generator also emits are omitted because nothing uses them.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      beans: {
        Row: {
          altitude_m: number | null
          created_at: string
          created_by: string | null
          id: string
          match_key: string | null
          name: string
          origin: string | null
          process: string | null
          producer: string | null
          region: string | null
          roast_level: string | null
          roaster: string
          roaster_notes: string[]
          variety: string | null
        }
        Insert: {
          altitude_m?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          match_key?: string | null
          name: string
          origin?: string | null
          process?: string | null
          producer?: string | null
          region?: string | null
          roast_level?: string | null
          roaster: string
          roaster_notes?: string[]
          variety?: string | null
        }
        Update: {
          altitude_m?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          match_key?: string | null
          name?: string
          origin?: string | null
          process?: string | null
          producer?: string | null
          region?: string | null
          roast_level?: string | null
          roaster?: string
          roaster_notes?: string[]
          variety?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'beans_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      brews: {
        Row: {
          actual_time_s: number | null
          brewed_at: string
          change_applied: Json | null
          created_at: string
          feedback: Json | null
          id: string
          outcome_improved: boolean | null
          params: Json
          recipe_version_id: string
          tuning: Json | null
          user_bean_id: string
          user_id: string
          yield_ml: number | null
        }
        Insert: {
          actual_time_s?: number | null
          brewed_at?: string
          change_applied?: Json | null
          created_at?: string
          feedback?: Json | null
          id?: string
          outcome_improved?: boolean | null
          params: Json
          recipe_version_id: string
          tuning?: Json | null
          user_bean_id: string
          user_id?: string
          yield_ml?: number | null
        }
        Update: {
          actual_time_s?: number | null
          brewed_at?: string
          change_applied?: Json | null
          created_at?: string
          feedback?: Json | null
          id?: string
          outcome_improved?: boolean | null
          params?: Json
          recipe_version_id?: string
          tuning?: Json | null
          user_bean_id?: string
          user_id?: string
          yield_ml?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'brews_recipe_version_id_fkey'
            columns: ['recipe_version_id']
            isOneToOne: false
            referencedRelation: 'recipe_versions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'brews_user_bean_id_fkey'
            columns: ['user_bean_id']
            isOneToOne: false
            referencedRelation: 'user_beans'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'brews_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      filters: {
        Row: {
          bleached: boolean | null
          brand: string
          created_by: string | null
          flow_class: string | null
          id: string
          match_key: string | null
          material: string
          model: string
          size: string | null
        }
        Insert: {
          bleached?: boolean | null
          brand: string
          created_by?: string | null
          flow_class?: string | null
          id?: string
          match_key?: string | null
          material?: string
          model: string
          size?: string | null
        }
        Update: {
          bleached?: boolean | null
          brand?: string
          created_by?: string | null
          flow_class?: string | null
          id?: string
          match_key?: string | null
          material?: string
          model?: string
          size?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'filters_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: 'friendships_user_a_fkey'
            columns: ['user_a']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'friendships_user_b_fkey'
            columns: ['user_b']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      grinder_calibration: {
        Row: {
          grinder_id: string
          microns: number
          setting: number
          source: string
        }
        Insert: {
          grinder_id: string
          microns: number
          setting: number
          source: string
        }
        Update: {
          grinder_id?: string
          microns?: number
          setting?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: 'grinder_calibration_grinder_id_fkey'
            columns: ['grinder_id']
            isOneToOne: false
            referencedRelation: 'grinders'
            referencedColumns: ['id']
          },
        ]
      }
      grinders: {
        Row: {
          brand: string
          id: string
          max_setting: number | null
          min_setting: number | null
          model: string
          setting_step: number
          unit_label: string
        }
        Insert: {
          brand: string
          id?: string
          max_setting?: number | null
          min_setting?: number | null
          model: string
          setting_step?: number
          unit_label: string
        }
        Update: {
          brand?: string
          id?: string
          max_setting?: number | null
          min_setting?: number | null
          model?: string
          setting_step?: number
          unit_label?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          expires_at: string
          inviter_id: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          expires_at: string
          inviter_id: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          expires_at?: string
          inviter_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invites_accepted_by_fkey'
            columns: ['accepted_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invites_inviter_id_fkey'
            columns: ['inviter_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_method: string
          display_name: string
          id: string
          temp_unit: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_method?: string
          display_name: string
          id: string
          temp_unit?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_method?: string
          display_name?: string
          id?: string
          temp_unit?: string
        }
        Relationships: []
      }
      recipe_versions: {
        Row: {
          created_at: string
          forked_from_version_id: string | null
          grind_um: number
          id: string
          params: Json
          parent_version_id: string | null
          recipe_id: string
        }
        Insert: {
          created_at?: string
          forked_from_version_id?: string | null
          grind_um: number
          id?: string
          params: Json
          parent_version_id?: string | null
          recipe_id: string
        }
        Update: {
          created_at?: string
          forked_from_version_id?: string | null
          grind_um?: number
          id?: string
          params?: Json
          parent_version_id?: string | null
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'recipe_versions_parent_version_id_fkey'
            columns: ['parent_version_id']
            isOneToOne: false
            referencedRelation: 'recipe_versions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recipe_versions_recipe_id_fkey'
            columns: ['recipe_id']
            isOneToOne: false
            referencedRelation: 'recipes'
            referencedColumns: ['id']
          },
        ]
      }
      recipe_drafts: {
        Row: {
          bean_id: string
          choices: Json
          last_brew: Json | null
          method: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bean_id: string
          choices: Json
          last_brew?: Json | null
          method: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          bean_id?: string
          choices?: Json
          last_brew?: Json | null
          method?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'recipe_drafts_bean_id_fkey'
            columns: ['bean_id']
            isOneToOne: false
            referencedRelation: 'beans'
            referencedColumns: ['id']
          },
        ]
      }
      recipes: {
        Row: {
          archived_at: string | null
          bean_id: string
          created_at: string
          id: string
          locked_version_id: string | null
          method: string
          name: string
          owner_id: string
        }
        Insert: {
          archived_at?: string | null
          bean_id: string
          created_at?: string
          id?: string
          locked_version_id?: string | null
          method: string
          name: string
          owner_id?: string
        }
        Update: {
          archived_at?: string | null
          bean_id?: string
          created_at?: string
          id?: string
          locked_version_id?: string | null
          method?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'recipes_bean_id_fkey'
            columns: ['bean_id']
            isOneToOne: false
            referencedRelation: 'beans'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'recipes_locked_version_fk'
            columns: ['locked_version_id', 'id']
            isOneToOne: false
            referencedRelation: 'recipe_versions'
            referencedColumns: ['id', 'recipe_id']
          },
          {
            foreignKeyName: 'recipes_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      user_beans: {
        Row: {
          bean_id: string
          collection: string | null
          created_at: string
          grams_remaining: number | null
          id: string
          notes: string | null
          roast_date: string | null
          status: string
          user_id: string
        }
        Insert: {
          bean_id: string
          collection?: string | null
          created_at?: string
          grams_remaining?: number | null
          id?: string
          notes?: string | null
          roast_date?: string | null
          status?: string
          user_id?: string
        }
        Update: {
          bean_id?: string
          collection?: string | null
          created_at?: string
          grams_remaining?: number | null
          id?: string
          notes?: string | null
          roast_date?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_beans_bean_id_fkey'
            columns: ['bean_id']
            isOneToOne: false
            referencedRelation: 'beans'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_beans_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      user_filters: {
        Row: {
          filter_id: string
          is_default: boolean
          nickname: string | null
          user_id: string
        }
        Insert: {
          filter_id: string
          is_default?: boolean
          nickname?: string | null
          user_id?: string
        }
        Update: {
          filter_id?: string
          is_default?: boolean
          nickname?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_filters_filter_id_fkey'
            columns: ['filter_id']
            isOneToOne: false
            referencedRelation: 'filters'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_filters_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      user_grinders: {
        Row: {
          grinder_id: string
          nickname: string | null
          offset_um: number
          user_id: string
        }
        Insert: {
          grinder_id: string
          nickname?: string | null
          offset_um?: number
          user_id?: string
        }
        Update: {
          grinder_id?: string
          nickname?: string | null
          offset_um?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_grinders_grinder_id_fkey'
            columns: ['grinder_id']
            isOneToOne: false
            referencedRelation: 'grinders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'user_grinders_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      peek_invite: { Args: { p_token: string }; Returns: Json }
      cancel_invite: { Args: { p_token_hash: string }; Returns: undefined }
      browse_beans: {
        Args: { max_results?: number }
        Returns: {
          altitude_m: number
          friends_with_recipe: number
          id: string
          name: string
          origin: string
          owned: boolean
          process: string
          producer: string
          region: string
          roast_level: string
          roaster: string
          roaster_notes: string[]
          variety: string
        }[]
      }
      lock_recipe: {
        Args: {
          p_actual_time_s: number | null
          p_brew_id: string
          p_brew_params: Json
          p_brewed_at?: string
          p_feedback: Json
          p_grind_um: number
          p_method: string
          p_name: string
          p_params: Json
          p_recipe_id: string
          p_user_bean_id: string
          p_version_id: string
          p_yield_ml: number | null
        }
        Returns: string
      }
      accept_invite: { Args: { token: string }; Returns: Json }
      add_bag: {
        Args: {
          p_bag_id?: string
          p_bean_id?: string
          p_grams?: number
          p_new_bean?: Json
          p_new_bean_id?: string
          p_roast_date?: string
        }
        Returns: string
      }
      add_my_filter: { Args: { target: string }; Returns: undefined }
      create_invite: { Args: never; Returns: string }
      remove_my_filter: { Args: { target: string }; Returns: undefined }
      search_beans: {
        Args: { max_results?: number; q: string }
        Returns: {
          altitude_m: number
          friends_with_recipe: number
          id: string
          name: string
          origin: string
          owned: boolean
          process: string
          producer: string
          region: string
          roast_level: string
          roaster: string
          roaster_notes: string[]
          score: number
          variety: string
        }[]
      }
      set_default_filter: { Args: { target: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
