#!/bin/bash

# Script para organizar migraciones existentes en el formato de Supabase
# Este script ayuda a migrar tus archivos SQL existentes al sistema de migraciones

echo "📦 Organizando migraciones existentes..."

# Crear directorio de migraciones si no existe
mkdir -p supabase/migrations

# Contador para timestamps secuenciales
counter=1

# Lista de migraciones en orden cronológico aproximado
# Ajusta estos nombres según tus archivos reales
migrations=(
  "schema.sql:initial_schema"
  "migration_create_periods.sql:create_periods"
  "migration_create_songs.sql:create_songs"
  "migration_create_course_registrations.sql:create_course_registrations"
  "migration_create_professor_subject_periods.sql:create_professor_subject_periods"
  "migration_guardian_students.sql:create_guardian_students"
  "migration_create_audit_logs.sql:create_audit_logs"
  "migration_add_soft_delete.sql:add_soft_delete"
  "migration_separate_student_name.sql:separate_student_name"
  "migration_add_student_additional_info.sql:add_student_additional_info"
  "migration_schedules.sql:create_schedules"
  "migration_add_subject_id_to_schedules.sql:add_subject_id_to_schedules"
  "migration_schedules_add_period_id.sql:add_period_id_to_schedules"
  "migration_course_registrations_add_profile_id.sql:add_profile_id_to_course_registrations"
  "migration_remove_professors_table.sql:remove_professors_table"
  "migration_drop_enrollments_table.sql:drop_enrollments_table"
)

# Generar timestamp base (2024-01-01 00:00:00)
base_date="20240101"
base_time="000000"

for migration_pair in "${migrations[@]}"; do
  IFS=':' read -r source_file migration_name <<< "$migration_pair"
  
  if [ -f "supabase/$source_file" ]; then
    # Generar timestamp secuencial (agregar minutos)
    minutes=$((counter * 5))
    hours=$((minutes / 60))
    minutes=$((minutes % 60))
    
    # Formatear timestamp: YYYYMMDDHHMMSS
    timestamp=$(date -j -f "%Y%m%d%H%M%S" "${base_date}${hours}${minutes}00" +"%Y%m%d%H%M%S" 2>/dev/null || \
                date -d "${base_date} +${hours} hours +${minutes} minutes" +"%Y%m%d%H%M%S" 2>/dev/null || \
                printf "%s%02d%02d00" "$base_date" "$hours" "$minutes")
    
    new_filename="supabase/migrations/${timestamp}_${migration_name}.sql"
    
    echo "📄 Copiando $source_file → $new_filename"
    cp "supabase/$source_file" "$new_filename"
    
    counter=$((counter + 1))
  else
    echo "⚠️  Archivo no encontrado: supabase/$source_file"
  fi
done

echo ""
echo "✅ Migraciones organizadas en supabase/migrations/"
echo ""
echo "📝 Próximos pasos:"
echo "1. Revisa los archivos en supabase/migrations/"
echo "2. Ajusta los timestamps si es necesario"
echo "3. Ejecuta: supabase migration list"
echo "4. Aplica: supabase db push"
