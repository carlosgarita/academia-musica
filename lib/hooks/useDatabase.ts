import { useCallback } from "react";
import { useSupabase } from "./useSupabase";
import {
  createProfile,
  createProfessor,
  createStudent,
  getProfile,
  getProfessors,
  getStudents,
} from "../supabase/db";
import type { Database } from "../database.types";

type Tables = Database["public"]["Tables"];

export function useDatabase() {
  const client = useSupabase();

  const handleCreateProfile = useCallback(
    async (data: Tables["profiles"]["Insert"]) => {
      return createProfile(client, data);
    },
    [client]
  );

  const handleCreateProfessor = useCallback(
    async (data: Tables["professors"]["Insert"]) => {
      return createProfessor(client, data);
    },
    [client]
  );

  const handleCreateStudent = useCallback(
    async (data: Tables["students"]["Insert"]) => {
      return createStudent(client, data);
    },
    [client]
  );

  const handleGetProfile = useCallback(
    async (userId: string) => {
      return getProfile(client, userId);
    },
    [client]
  );

  const handleGetProfessors = useCallback(
    async (academyId: string) => {
      return getProfessors(client, academyId);
    },
    [client]
  );

  const handleGetStudents = useCallback(
    async (academyId: string) => {
      return getStudents(client, academyId);
    },
    [client]
  );

  return {
    createProfile: handleCreateProfile,
    createProfessor: handleCreateProfessor,
    createStudent: handleCreateStudent,
    getProfile: handleGetProfile,
    getProfessors: handleGetProfessors,
    getStudents: handleGetStudents,
  };
}
