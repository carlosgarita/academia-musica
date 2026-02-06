export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      academies: {
        Row: {
          address: string | null;
          created_at: string;
          id: string;
          logo_url: string | null;
          name: string;
          phone: string | null;
          status: string | null;
          timezone: string | null;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          name: string;
          phone?: string | null;
          status?: string | null;
          timezone?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          name?: string;
          phone?: string | null;
          status?: string | null;
          timezone?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          change_type: string | null;
          changed_by: string | null;
          created_at: string;
          id: string;
          new_value: string | null;
          old_value: string | null;
          record_id: string;
          related_session_id: string | null;
          related_student_id: string | null;
          table_name: string;
          user_id: string | null;
        };
        Insert: {
          action: string;
          change_type?: string | null;
          changed_by?: string | null;
          created_at?: string;
          id?: string;
          new_value?: string | null;
          old_value?: string | null;
          record_id: string;
          related_session_id?: string | null;
          related_student_id?: string | null;
          table_name: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          change_type?: string | null;
          changed_by?: string | null;
          created_at?: string;
          id?: string;
          new_value?: string | null;
          old_value?: string | null;
          record_id?: string;
          related_session_id?: string | null;
          related_student_id?: string | null;
          table_name?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_related_session_id_fkey";
            columns: ["related_session_id"];
            isOneToOne: false;
            referencedRelation: "period_dates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_related_student_id_fkey";
            columns: ["related_student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          }
        ];
      };
      badges: {
        Row: {
          academy_id: string;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          id: string;
          image_url: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          academy_id: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          image_url: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          academy_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          image_url?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "badges_academy_id_fkey";
            columns: ["academy_id"];
            isOneToOne: false;
            referencedRelation: "academies";
            referencedColumns: ["id"];
          }
        ];
      };
      course_registration_songs: {
        Row: {
          course_registration_id: string;
          created_at: string;
          id: string;
          song_id: string;
        };
        Insert: {
          course_registration_id: string;
          created_at?: string;
          id?: string;
          song_id: string;
        };
        Update: {
          course_registration_id?: string;
          created_at?: string;
          id?: string;
          song_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "course_registration_songs_course_registration_id_fkey";
            columns: ["course_registration_id"];
            isOneToOne: false;
            referencedRelation: "course_registrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_registration_songs_song_id_fkey";
            columns: ["song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          }
        ];
      };
      course_registrations: {
        Row: {
          academy_id: string;
          created_at: string;
          deleted_at: string | null;
          enrollment_date: string | null;
          id: string;
          period_id: string;
          profile_id: string | null;
          status: string | null;
          student_id: string;
          subject_id: string;
          updated_at: string;
        };
        Insert: {
          academy_id: string;
          created_at?: string;
          deleted_at?: string | null;
          enrollment_date?: string | null;
          id?: string;
          period_id: string;
          profile_id?: string | null;
          status?: string | null;
          student_id: string;
          subject_id: string;
          updated_at?: string;
        };
        Update: {
          academy_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          enrollment_date?: string | null;
          id?: string;
          period_id?: string;
          profile_id?: string | null;
          status?: string | null;
          student_id?: string;
          subject_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "course_registrations_academy_id_fkey";
            columns: ["academy_id"];
            isOneToOne: false;
            referencedRelation: "academies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_registrations_period_id_fkey";
            columns: ["period_id"];
            isOneToOne: false;
            referencedRelation: "periods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_registrations_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_registrations_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_registrations_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          }
        ];
      };
      evaluation_rubrics: {
        Row: {
          academy_id: string;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          display_order: number | null;
          id: string;
          is_default: boolean | null;
          name: string;
          updated_at: string;
        };
        Insert: {
          academy_id: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          id?: string;
          is_default?: boolean | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          academy_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          id?: string;
          is_default?: boolean | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evaluation_rubrics_academy_id_fkey";
            columns: ["academy_id"];
            isOneToOne: false;
            referencedRelation: "academies";
            referencedColumns: ["id"];
          }
        ];
      };
      evaluation_scales: {
        Row: {
          academy_id: string;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          display_order: number | null;
          id: string;
          is_default: boolean | null;
          name: string;
          numeric_value: number;
          updated_at: string;
        };
        Insert: {
          academy_id: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          id?: string;
          is_default?: boolean | null;
          name: string;
          numeric_value: number;
          updated_at?: string;
        };
        Update: {
          academy_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          display_order?: number | null;
          id?: string;
          is_default?: boolean | null;
          name?: string;
          numeric_value?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evaluation_scales_academy_id_fkey";
            columns: ["academy_id"];
            isOneToOne: false;
            referencedRelation: "academies";
            referencedColumns: ["id"];
          }
        ];
      };
      guardian_students: {
        Row: {
          academy_id: string;
          created_at: string;
          guardian_id: string;
          id: string;
          relationship: string | null;
          student_id: string;
        };
        Insert: {
          academy_id: string;
          created_at?: string;
          guardian_id: string;
          id?: string;
          relationship?: string | null;
          student_id: string;
        };
        Update: {
          academy_id?: string;
          created_at?: string;
          guardian_id?: string;
          id?: string;
          relationship?: string | null;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guardian_students_academy_id_fkey";
            columns: ["academy_id"];
            isOneToOne: false;
            referencedRelation: "academies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guardian_students_guardian_id_fkey";
            columns: ["guardian_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guardian_students_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: true;
            referencedRelation: "students";
            referencedColumns: ["id"];
          }
        ];
      };
      period_dates: {
        Row: {
          comment: string | null;
          created_at: string;
          date: string;
          date_type: string;
          deleted_at: string | null;
          id: string;
          period_id: string;
          profile_id: string | null;
          subject_id: string | null;
          updated_at: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          date: string;
          date_type: string;
          deleted_at?: string | null;
          id?: string;
          period_id: string;
          profile_id?: string | null;
          subject_id?: string | null;
          updated_at?: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          date?: string;
          date_type?: string;
          deleted_at?: string | null;
          id?: string;
          period_id?: string;
          profile_id?: string | null;
          subject_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "period_dates_period_id_fkey";
            columns: ["period_id"];
            isOneToOne: false;
            referencedRelation: "periods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "period_dates_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "period_dates_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          }
        ];
      };
      periods: {
        Row: {
          academy_id: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          period: string;
          updated_at: string;
          year: number;
        };
        Insert: {
          academy_id: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          period: string;
          updated_at?: string;
          year: number;
        };
        Update: {
          academy_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          period?: string;
          updated_at?: string;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: "periods_academy_id_fkey";
            columns: ["academy_id"];
            isOneToOne: false;
            referencedRelation: "academies";
            referencedColumns: ["id"];
          }
        ];
      };
      professor_subject_periods: {
        Row: {
          created_at: string;
          id: string;
          period_id: string;
          profile_id: string;
          subject_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          period_id: string;
          profile_id: string;
          subject_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          period_id?: string;
          profile_id?: string;
          subject_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "professor_subject_periods_period_id_fkey";
            columns: ["period_id"];
            isOneToOne: false;
            referencedRelation: "periods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "professor_subject_periods_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "professor_subject_periods_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          }
        ];
      };
      professor_subjects: {
        Row: {
          created_at: string;
          id: string;
          profile_id: string;
          subject_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          profile_id: string;
          subject_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          profile_id?: string;
          subject_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "professor_subjects_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "professor_subjects_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          }
        ];
      };
      profiles: {
        Row: {
          academy_id: string | null;
          additional_info: string | null;
          created_at: string;
          deleted_at: string | null;
          email: string;
          first_name: string | null;
          id: string;
          last_name: string | null;
          phone: string | null;
          role: string;
          status: string | null;
          updated_at: string;
        };
        Insert: {
          academy_id?: string | null;
          additional_info?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email: string;
          first_name?: string | null;
          id: string;
          last_name?: string | null;
          phone?: string | null;
          role: string;
          status?: string | null;
          updated_at?: string;
        };
        Update: {
          academy_id?: string | null;
          additional_info?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          phone?: string | null;
          role?: string;
          status?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_academy_id_fkey";
            columns: ["academy_id"];
            isOneToOne: false;
            referencedRelation: "academies";
            referencedColumns: ["id"];
          }
        ];
      };
      schedules: {
        Row: {
          academy_id: string;
          created_at: string;
          day_of_week: number;
          deleted_at: string | null;
          end_time: string;
          id: string;
          name: string;
          period_id: string | null;
          profile_id: string;
          start_time: string;
          subject_id: string | null;
          updated_at: string;
        };
        Insert: {
          academy_id: string;
          created_at?: string;
          day_of_week: number;
          deleted_at?: string | null;
          end_time: string;
          id?: string;
          name: string;
          period_id?: string | null;
          profile_id: string;
          start_time: string;
          subject_id?: string | null;
          updated_at?: string;
        };
        Update: {
          academy_id?: string;
          created_at?: string;
          day_of_week?: number;
          deleted_at?: string | null;
          end_time?: string;
          id?: string;
          name?: string;
          period_id?: string | null;
          profile_id?: string;
          start_time?: string;
          subject_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "schedules_academy_id_fkey";
            columns: ["academy_id"];
            isOneToOne: false;
            referencedRelation: "academies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "schedules_period_id_fkey";
            columns: ["period_id"];
            isOneToOne: false;
            referencedRelation: "periods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "schedules_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "schedules_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          }
        ];
      };
      session_assignments: {
        Row: {
          assignment_text: string;
          course_registration_id: string;
          created_at: string;
          id: string;
          period_date_id: string;
          updated_at: string;
        };
        Insert: {
          assignment_text: string;
          course_registration_id: string;
          created_at?: string;
          id?: string;
          period_date_id: string;
          updated_at?: string;
        };
        Update: {
          assignment_text?: string;
          course_registration_id?: string;
          created_at?: string;
          id?: string;
          period_date_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "session_assignments_course_registration_id_fkey";
            columns: ["course_registration_id"];
            isOneToOne: false;
            referencedRelation: "course_registrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_assignments_period_date_id_fkey";
            columns: ["period_date_id"];
            isOneToOne: false;
            referencedRelation: "period_dates";
            referencedColumns: ["id"];
          }
        ];
      };
      session_attendances: {
        Row: {
          attendance_status: string;
          course_registration_id: string;
          created_at: string;
          id: string;
          notes: string | null;
          period_date_id: string;
          updated_at: string;
        };
        Insert: {
          attendance_status: string;
          course_registration_id: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          period_date_id: string;
          updated_at?: string;
        };
        Update: {
          attendance_status?: string;
          course_registration_id?: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          period_date_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "session_attendances_course_registration_id_fkey";
            columns: ["course_registration_id"];
            isOneToOne: false;
            referencedRelation: "course_registrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_attendances_period_date_id_fkey";
            columns: ["period_date_id"];
            isOneToOne: false;
            referencedRelation: "period_dates";
            referencedColumns: ["id"];
          }
        ];
      };
      session_comments: {
        Row: {
          comment: string;
          course_registration_id: string;
          created_at: string;
          id: string;
          period_date_id: string;
          updated_at: string;
        };
        Insert: {
          comment: string;
          course_registration_id: string;
          created_at?: string;
          id?: string;
          period_date_id: string;
          updated_at?: string;
        };
        Update: {
          comment?: string;
          course_registration_id?: string;
          created_at?: string;
          id?: string;
          period_date_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "session_comments_course_registration_id_fkey";
            columns: ["course_registration_id"];
            isOneToOne: false;
            referencedRelation: "course_registrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_comments_period_date_id_fkey";
            columns: ["period_date_id"];
            isOneToOne: false;
            referencedRelation: "period_dates";
            referencedColumns: ["id"];
          }
        ];
      };
      session_group_assignments: {
        Row: {
          assignment_text: string;
          created_at: string;
          id: string;
          period_date_id: string;
          updated_at: string;
        };
        Insert: {
          assignment_text: string;
          created_at?: string;
          id?: string;
          period_date_id: string;
          updated_at?: string;
        };
        Update: {
          assignment_text?: string;
          created_at?: string;
          id?: string;
          period_date_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "session_group_assignments_period_date_id_fkey";
            columns: ["period_date_id"];
            isOneToOne: true;
            referencedRelation: "period_dates";
            referencedColumns: ["id"];
          }
        ];
      };
      song_evaluations: {
        Row: {
          course_registration_id: string;
          created_at: string;
          id: string;
          period_date_id: string;
          rubric_id: string;
          scale_id: string | null;
          song_id: string;
          updated_at: string;
        };
        Insert: {
          course_registration_id: string;
          created_at?: string;
          id?: string;
          period_date_id: string;
          rubric_id: string;
          scale_id?: string | null;
          song_id: string;
          updated_at?: string;
        };
        Update: {
          course_registration_id?: string;
          created_at?: string;
          id?: string;
          period_date_id?: string;
          rubric_id?: string;
          scale_id?: string | null;
          song_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "song_evaluations_course_registration_id_fkey";
            columns: ["course_registration_id"];
            isOneToOne: false;
            referencedRelation: "course_registrations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "song_evaluations_period_date_id_fkey";
            columns: ["period_date_id"];
            isOneToOne: false;
            referencedRelation: "period_dates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "song_evaluations_rubric_id_fkey";
            columns: ["rubric_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_rubrics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "song_evaluations_scale_id_fkey";
            columns: ["scale_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_scales";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "song_evaluations_song_id_fkey";
            columns: ["song_id"];
            isOneToOne: false;
            referencedRelation: "songs";
            referencedColumns: ["id"];
          }
        ];
      };
      songs: {
        Row: {
          academy_id: string;
          author: string | null;
          created_at: string;
          deleted_at: string | null;
          difficulty_level: number;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          academy_id: string;
          author?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          difficulty_level: number;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          academy_id?: string;
          author?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          difficulty_level?: number;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "songs_academy_id_fkey";
            columns: ["academy_id"];
            isOneToOne: false;
            referencedRelation: "academies";
            referencedColumns: ["id"];
          }
        ];
      };
      student_badges: {
        Row: {
          assigned_at: string;
          assigned_by: string | null;
          badge_id: string;
          course_registration_id: string;
          created_at: string;
          id: string;
          notes: string | null;
        };
        Insert: {
          assigned_at?: string;
          assigned_by?: string | null;
          badge_id: string;
          course_registration_id: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string | null;
          badge_id?: string;
          course_registration_id?: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "student_badges_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_badges_badge_id_fkey";
            columns: ["badge_id"];
            isOneToOne: false;
            referencedRelation: "badges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_badges_course_registration_id_fkey";
            columns: ["course_registration_id"];
            isOneToOne: false;
            referencedRelation: "course_registrations";
            referencedColumns: ["id"];
          }
        ];
      };
      students: {
        Row: {
          academy_id: string;
          additional_info: string | null;
          created_at: string;
          date_of_birth: string | null;
          deleted_at: string | null;
          enrollment_status: string | null;
          first_name: string;
          id: string;
          is_self_guardian: boolean;
          last_name: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          academy_id: string;
          additional_info?: string | null;
          created_at?: string;
          date_of_birth?: string | null;
          deleted_at?: string | null;
          enrollment_status?: string | null;
          first_name: string;
          id?: string;
          is_self_guardian?: boolean;
          last_name: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          academy_id?: string;
          additional_info?: string | null;
          created_at?: string;
          date_of_birth?: string | null;
          deleted_at?: string | null;
          enrollment_status?: string | null;
          first_name?: string;
          id?: string;
          is_self_guardian?: boolean;
          last_name?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "students_academy_id_fkey";
            columns: ["academy_id"];
            isOneToOne: false;
            referencedRelation: "academies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "students_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      subject_rubrics: {
        Row: {
          created_at: string;
          id: string;
          rubric_id: string;
          subject_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          rubric_id: string;
          subject_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          rubric_id?: string;
          subject_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subject_rubrics_rubric_id_fkey";
            columns: ["rubric_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_rubrics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subject_rubrics_subject_id_fkey";
            columns: ["subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["id"];
          }
        ];
      };
      subjects: {
        Row: {
          academy_id: string;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          academy_id: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          academy_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subjects_academy_id_fkey";
            columns: ["academy_id"];
            isOneToOne: false;
            referencedRelation: "academies";
            referencedColumns: ["id"];
          }
        ];
      };
      task_completions: {
        Row: {
          id: string;
          session_assignment_id: string | null;
          session_group_assignment_id: string | null;
          student_id: string;
          completed_by: string;
          completed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_assignment_id?: string | null;
          session_group_assignment_id?: string | null;
          student_id: string;
          completed_by: string;
          completed_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_assignment_id?: string | null;
          session_group_assignment_id?: string | null;
          student_id?: string;
          completed_by?: string;
          completed_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_completions_session_assignment_id_fkey";
            columns: ["session_assignment_id"];
            isOneToOne: false;
            referencedRelation: "session_assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_completions_session_group_assignment_id_fkey";
            columns: ["session_group_assignment_id"];
            isOneToOne: false;
            referencedRelation: "session_group_assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_completions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "task_completions_completed_by_fkey";
            columns: ["completed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      check_schedule_conflicts:
        | {
            Args: {
              p_academy_id: string;
              p_day_of_week: number;
              p_end_time: string;
              p_schedule_id?: string;
              p_start_time: string;
            };
            Returns: boolean;
          }
        | {
            Args: {
              p_academy_id: string;
              p_day_of_week: number;
              p_end_time: string;
              p_professor_id: string;
              p_schedule_id?: string;
              p_start_time: string;
            };
            Returns: {
              conflict_message: string;
              conflict_type: string;
              conflicting_schedule_id: string;
              conflicting_schedule_name: string;
            }[];
          };
      insert_default_evaluation_data: {
        Args: { academy_uuid: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
      DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
      DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
