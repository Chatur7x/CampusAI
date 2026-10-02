// =============================================================
// AISMS - Supabase Edge Function
// Attendance: fetch + manual mark (aligned to Supabase schema)
// =============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const ALLOWED_MARK_ROLES = ['ADMIN', 'SUPER_ADMIN', 'FACULTY', 'CLASS_INCHARGE']
const ALLOWED_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'ON_LEAVE', 'EXCUSED']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ success: false, message: 'Missing Authorization header' }, 401)
    }
    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
    if (userError || !user) {
      return json({ success: false, message: 'Unauthorized' }, 401)
    }

    const userRole = await getRole(supabase, user.id)
    if (!userRole) {
      return json({ success: false, message: 'User role not found' }, 403)
    }

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const studentId = url.searchParams.get('studentId')
      const classId = url.searchParams.get('classId')
      const startDate = url.searchParams.get('startDate')
      const endDate = url.searchParams.get('endDate')
      const subjectId = url.searchParams.get('subjectId')

      let query = supabase
        .from('attendance')
        .select('*, student:student_id(class_id)')
        .order('date', { ascending: false })

      if (studentId) query = query.eq('student_id', studentId)
      if (subjectId) query = query.eq('subject_id', subjectId)
      if (classId) query = query.eq('student.class_id', classId)
      if (startDate) query = query.gte('date', startDate)
      if (endDate) query = query.lte('date', endDate)

      const { data, error } = await query
      // PostgREST messages can name columns, constraints and relation paths, so
      // they are logged server-side rather than returned.
      if (error) {
        console.error('attendance GET failed', error)
        return json({ success: false, message: 'Could not load attendance' }, 500)
      }

      const total = data?.length || 0
      const present = data?.filter((a) => a.status === 'PRESENT').length || 0
      const absent = data?.filter((a) => a.status === 'ABSENT').length || 0
      const late = data?.filter((a) => a.status === 'LATE').length || 0
      const percentage = total > 0 ? Math.round(((present + late) / total) * 10000) / 100 : 0

      return json({ success: true, data: { attendance: data, stats: { total, present, absent, late, percentage } } })
    }

    if (req.method === 'POST') {
      if (!ALLOWED_MARK_ROLES.includes(userRole)) {
        return json({ success: false, message: 'Insufficient permissions' }, 403)
      }

      const body = await req.json()
      const { studentId, status, subjectId, justification, timetableEntryId } = body
      if (!studentId || !status) {
        return json({ success: false, message: 'studentId and status are required' }, 400)
      }
      if (!ALLOWED_STATUSES.includes(status)) {
        return json({ success: false, message: 'Invalid attendance status' }, 400)
      }

      // Role check alone was insufficient: any faculty could mark attendance for
      // any student. Require ownership of the student's class.
      if (!await staffOwnsStudent(supabase, user.id, userRole, studentId)) {
        return json({ success: false, message: 'Not authorized to mark attendance for this student' }, 403)
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const facultyId = await getFacultyId(supabase, user.id)

      const { data, error } = await supabase
        .from('attendance')
        .upsert({
          student_id: studentId,
          subject_id: subjectId ?? null,
          timetable_entry_id: timetableEntryId ?? null,
          date: today.toISOString().split('T')[0],
          status,
          method: 'MANUAL',
          verified_by: facultyId ?? null,
          justification: justification ?? null,
        }, { onConflict: 'student_id,date,subject_id' })
        .select()
        .single()

      if (error) return json({ success: false, message: 'Attendance mark failed' }, 500)

      return json({ success: true, message: 'Attendance marked', data })
    }

    if (req.method === 'PUT') {
      if (!ALLOWED_MARK_ROLES.includes(userRole)) {
        return json({ success: false, message: 'Insufficient permissions' }, 403)
      }

      const url = new URL(req.url)
      const id = url.searchParams.get('id')
      if (!id) {
        return json({ success: false, message: 'id is required' }, 400)
      }

      const body = await req.json()
      const { status, justification } = body

      if (status && !ALLOWED_STATUSES.includes(status)) {
        return json({ success: false, message: 'Invalid attendance status' }, 400)
      }

      const { data: existing, error: readErr } = await supabase
        .from('attendance')
        .select('id, student_id')
        .eq('id', id)
        .single()
      if (readErr || !existing) {
        return json({ success: false, message: 'Attendance record not found' }, 404)
      }

      // Only staff who own the student's class may amend the record.
      if (!await staffOwnsStudent(supabase, user.id, userRole, existing.student_id)) {
        return json({ success: false, message: 'Not authorized to modify this record' }, 403)
      }

      const patch: Record<string, unknown> = {}
      if (status) patch.status = status
      if (justification !== undefined) patch.justification = justification

      if (Object.keys(patch).length === 0) {
        return json({ success: false, message: 'No updatable fields supplied' }, 400)
      }

      const { data, error } = await supabase
        .from('attendance')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) return json({ success: false, message: 'Update failed' }, 500)

      return json({ success: true, message: 'Attendance updated', data })
    }

    return json({ success: false, message: 'Method not allowed' }, 405)
  } catch (err) {
    console.error('Attendance function error', err)
    return json({ success: false, message: 'Internal server error' }, 500)
  }
})

async function getRole(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .single()
  if (error) return null
  return (data as { role?: string })?.role ?? null
}

/**
 * True when the caller is allowed to act on this student's attendance.
 * Admins always pass. Faculty/class-in-charge must be the in-charge faculty of
 * the student's class — a missing faculty row fails closed rather than
 * defaulting to "allowed".
 */
async function staffOwnsStudent(
  supabase: SupabaseClient,
  userId: string,
  userRole: string,
  studentId: string,
): Promise<boolean> {
  if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') return true

  const facultyId = await getFacultyId(supabase, userId)
  if (!facultyId) return false

  const { data, error } = await supabase
    .from('students')
    .select('id, classes!inner(incharge_id)')
    .eq('id', studentId)
    .eq('classes.incharge_id', facultyId)
    .limit(1)
    .maybeSingle()

  return !error && !!data
}

async function getFacultyId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('faculty')
    .select('id')
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return (data as { id: string })?.id ?? null
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
