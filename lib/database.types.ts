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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          academy_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          academy_id?: string;
          name?: string;
          description?: string | null;
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
