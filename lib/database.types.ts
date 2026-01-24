export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      academies: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          phone: string | null;
          website: string | null;
          logo_url: string | null;
          timezone: string | null;
          status: "active" | "inactive" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          phone?: string | null;
          website?: string | null;
          logo_url?: string | null;
          timezone?: string | null;
          status?: "active" | "inactive" | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string | null;
          phone?: string | null;
          website?: string | null;
          logo_url?: string | null;
          timezone?: string | null;
          status?: "active" | "inactive" | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          role:
            | "super_admin"
            | "director"
            | "professor"
            | "student"
            | "guardian";
          academy_id: string | null;
          status: "active" | "inactive" | null;
          additional_info: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          role:
            | "super_admin"
            | "director"
            | "professor"
            | "student"
            | "guardian";
          academy_id?: string | null;
          status?: "active" | "inactive" | null;
          additional_info?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          role?:
            | "super_admin"
            | "director"
            | "professor"
            | "student"
            | "guardian";
          academy_id?: string | null;
          status?: "active" | "inactive" | null;
          additional_info?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      professor_subjects: {
        Row: {
          id: string;
          profile_id: string;
          subject_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          subject_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          subject_id?: string;
          created_at?: string;
        };
      };
      students: {
        Row: {
          id: string;
          user_id: string | null;
          academy_id: string;
          first_name: string;
          last_name: string;
          date_of_birth: string | null;
          additional_info: string | null;
          enrollment_status: "inscrito" | "retirado" | "graduado" | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          academy_id: string;
          first_name: string;
          last_name: string;
          date_of_birth?: string | null;
          additional_info?: string | null;
          enrollment_status?: "inscrito" | "retirado" | "graduado" | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          academy_id?: string;
          first_name?: string;
          last_name?: string;
          date_of_birth?: string | null;
          additional_info?: string | null;
          enrollment_status?: "inscrito" | "retirado" | "graduado" | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      subjects: {
        Row: {
          id: string;
          academy_id: string;
          name: string;
          description: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          academy_id: string;
          name: string;
          description?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          academy_id?: string;
          name?: string;
          description?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      schedules: {
        Row: {
          id: string;
          academy_id: string;
          subject_id: string | null;
          name: string;
          profile_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          academy_id: string;
          subject_id?: string | null;
          name: string;
          profile_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          academy_id?: string;
          subject_id?: string | null;
          name?: string;
          profile_id?: string;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      enrollments: {
        Row: {
          id: string;
          student_id: string;
          subject_id: string | null;
          schedule_id: string | null;
          teacher_id: string;
          academy_id: string;
          enrollment_date: string | null;
          status: "active" | "completed" | "cancelled" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          subject_id?: string | null;
          schedule_id?: string | null;
          teacher_id: string;
          academy_id: string;
          enrollment_date?: string | null;
          status?: "active" | "completed" | "cancelled" | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          subject_id?: string | null;
          schedule_id?: string | null;
          teacher_id?: string;
          academy_id?: string;
          enrollment_date?: string | null;
          status?: "active" | "completed" | "cancelled" | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      guardian_students: {
        Row: {
          id: string;
          guardian_id: string;
          student_id: string;
          academy_id: string;
          relationship: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          guardian_id: string;
          student_id: string;
          academy_id: string;
          relationship?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          guardian_id?: string;
          student_id?: string;
          academy_id?: string;
          relationship?: string | null;
          created_at?: string;
        };
      };
      songs: {
        Row: {
          id: string;
          academy_id: string;
          name: string;
          author: string | null;
          difficulty_level: number;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          academy_id: string;
          name: string;
          author?: string | null;
          difficulty_level: number;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          academy_id?: string;
          name?: string;
          author?: string | null;
          difficulty_level?: number;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      periods: {
        Row: {
          id: string;
          academy_id: string;
          year: number;
          period: "I" | "II" | "III" | "IV" | "V" | "VI";
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          academy_id: string;
          year: number;
          period: "I" | "II" | "III" | "IV" | "V" | "VI";
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          academy_id?: string;
          year?: number;
          period?: "I" | "II" | "III" | "IV" | "V" | "VI";
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      period_dates: {
        Row: {
          id: string;
          period_id: string;
          date_type: "inicio" | "cierre" | "feriado" | "recital" | "clase" | "otro";
          date: string;
          schedule_id: string | null;
          comment: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          period_id: string;
          date_type: "inicio" | "cierre" | "feriado" | "recital" | "clase" | "otro";
          date: string;
          schedule_id?: string | null;
          comment?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          period_id?: string;
          date_type?: "inicio" | "cierre" | "feriado" | "recital" | "clase" | "otro";
          date?: string;
          schedule_id?: string | null;
          comment?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      course_registrations: {
        Row: {
          id: string;
          student_id: string;
          subject_id: string;
          period_id: string;
          academy_id: string;
          status: "active" | "completed" | "cancelled";
          enrollment_date: string;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          subject_id: string;
          period_id: string;
          academy_id: string;
          status?: "active" | "completed" | "cancelled";
          enrollment_date?: string;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          subject_id?: string;
          period_id?: string;
          academy_id?: string;
          status?: "active" | "completed" | "cancelled";
          enrollment_date?: string;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      course_registration_songs: {
        Row: {
          id: string;
          course_registration_id: string;
          song_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          course_registration_id: string;
          song_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          course_registration_id?: string;
          song_id?: string;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          table_name: string;
          record_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          table_name: string;
          record_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action?: string;
          table_name?: string;
          record_id?: string;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
