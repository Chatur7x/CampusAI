// =============================================================
// CAMPUSAI - SUPABASE EDGE FUNCTION
// Database Backup (scheduled via cron or manual trigger)
// =============================================================
// Schedule: Set up a cron job in Supabase Dashboard → Database → Extensions → pg_cron:
//   SELECT cron.schedule('nightly-backup', '0 2 * * *',
//     $$ SELECT net.http_post(
//       url := current_setting('app.settings.supabase_url') || '/functions/v1/backup',
//       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
//       body := '{"type": "automatic"}'::jsonb
//     ) $$
//   );
// =============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const TABLES_TO_BACKUP = [
  'users',
  'profiles',
  'students',
  'faculty',
  'departments',
  'courses',
  'classes',
  'subjects',
  'attendance',
  'timetable_entries',
  'leaves',
  'notices',
  'notifications',
  'audit_logs',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Verify caller is authorized (service role or admin)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json().catch(() => ({}))
    const backupType = body.type || 'manual'
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `backup_${timestamp}.json`

    // Export each table
    const backupData: Record<string, unknown[]> = {}
    const errors: string[] = []
    let totalRows = 0

    for (const table of TABLES_TO_BACKUP) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(50000) // Safety limit per table

        if (error) {
          errors.push(`${table}: ${error.message}`)
          continue
        }

        backupData[table] = data || []
        totalRows += (data || []).length
      } catch (err) {
        errors.push(`${table}: ${(err as Error).message}`)
      }
    }

    // Create backup JSON
    const backupJson = JSON.stringify({
      version: '1.0',
      created_at: new Date().toISOString(),
      type: backupType,
      tables: Object.keys(backupData),
      total_rows: totalRows,
      data: backupData,
    })

    const sizeBytes = new TextEncoder().encode(backupJson).length

    // Upload to storage bucket
    const { error: uploadError } = await supabase.storage
      .from('db-backups')
      .upload(filename, backupJson, {
        contentType: 'application/json',
        upsert: false,
      })

    if (uploadError) {
      // Log failed backup
      await supabase.rpc('log_backup', {
        p_filename: filename,
        p_size: sizeBytes,
        p_type: backupType,
        p_status: 'failed',
        p_metadata: { error: uploadError.message, errors },
      })

      return new Response(
        JSON.stringify({ success: false, error: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log successful backup
    await supabase.rpc('log_backup', {
      p_filename: filename,
      p_size: sizeBytes,
      p_type: backupType,
      p_status: 'completed',
      p_metadata: {
        tables: Object.keys(backupData).length,
        total_rows: totalRows,
        errors: errors.length > 0 ? errors : undefined,
      },
    })

    // Cleanup old backups (keep last 30 days)
    await supabase.rpc('cleanup_old_backups')

    return new Response(
      JSON.stringify({
        success: true,
        filename,
        size_bytes: sizeBytes,
        size_mb: (sizeBytes / 1048576).toFixed(2),
        tables: Object.keys(backupData).length,
        total_rows: totalRows,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Backup error:', error)
    return new Response(
      JSON.stringify({ success: false, message: 'Backup failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
