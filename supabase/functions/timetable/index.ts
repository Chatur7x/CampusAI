// =============================================================
// AISMS - Supabase Edge Function
// Timetable: fetch + create/update/delete
// =============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN']
const CHUNK = 500

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ success: false, message: 'Missing Authorization' }, 401)
    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
    if (userError || !user) return json({ success: false, message: 'Unauthorized' }, 401)

    const role = await getRole(supabase, user.id)
    if (!role) return json({ success: false, message: 'User role not found' }, 403)

    const url = new URL(req.url)
    const id = url.searchParams.get('id')

    if (req.method === 'GET') {
      const classId = url.searchParams.get('classId')
      const facultyId = url.searchParams.get('facultyId')
      const studentId = url.searchParams.get('studentId')

      const where: Record<string, unknown> = {}
      if (classId) where['classId'] = classId
      if (facultyId) where['facultyId'] = facultyId

      if (studentId) {
        const { data: student } = await supabase.from('students').select('classId').eq('id', studentId).single()
        if (student?.classId) where['classId'] = student.classId
      }

      const { data, error } = await supabase
        .from('timetable')
        .select('*')
        .match(where)
        .order('dayOfWeek', { ascending: true })
        .order('startTime', { ascending: true })

      if (error) {
        // Fallback: try timetable_entries with snake_case columns
        const snakeWhere: Record<string, unknown> = {}
        if (classId) snakeWhere['class_id'] = classId
        if (facultyId) snakeWhere['faculty_id'] = facultyId
        if (where['classId'] && !classId) snakeWhere['class_id'] = where['classId']

        const fallback = await supabase
          .from('timetable_entries')
          .select('*')
          .match(snakeWhere)
          .order('day_of_week', { ascending: true })
          .order('start_time', { ascending: true })

        if (fallback.error) return json({ success: false, message: fallback.error.message }, 500)
        const grouped = groupByDay(fallback.data || [])
        return json({ success: true, data: { entries: fallback.data, groupedByDay: grouped } })
      }

      const grouped = groupByDay(data || [])
      return json({ success: true, data: { entries: data, groupedByDay: grouped } })
    }

    if (req.method === 'POST') {
      if (!ADMIN_ROLES.includes(role)) return json({ success: false, message: 'Insufficient permissions' }, 403)
      const body = await req.json()

      // bulk create if array
      if (Array.isArray(body)) {
        const results = []
        for (let i = 0; i < body.length; i += CHUNK) {
          const slice = body.slice(i, i + CHUNK)
          const { data, error } = await supabase.from('timetable').insert(slice).select()
          if (error) return json({ success: false, message: error.message }, 500)
          results.push(...(data || []))
        }
        return json({ success: true, message: `Created ${results.length} entries`, data: results })
      }

      const { data, error } = await supabase.from('timetable').insert(body).select().single()
      if (error) return json({ success: false, message: error.message }, 500)
      return json({ success: true, message: 'Timetable entry created', data })
    }

    if (req.method === 'PUT') {
      if (!ADMIN_ROLES.includes(role)) return json({ success: false, message: 'Insufficient permissions' }, 403)
      if (!id) return json({ success: false, message: 'id is required' }, 400)
      const body = await req.json()
      const { data, error } = await supabase.from('timetable').update(body).eq('id', id).select().single()
      if (error) return json({ success: false, message: error.message }, 500)
      return json({ success: true, message: 'Timetable entry updated', data })
    }

    if (req.method === 'DELETE') {
      if (!ADMIN_ROLES.includes(role)) return json({ success: false, message: 'Insufficient permissions' }, 403)
      if (!id) return json({ success: false, message: 'id is required' }, 400)
      const { error } = await supabase.from('timetable').delete().eq('id', id)
      if (error) return json({ success: false, message: error.message }, 500)
      return json({ success: true, message: 'Timetable entry deleted' })
    }

    return json({ success: false, message: 'Method not allowed' }, 405)
  } catch (err) {
    console.error('Timetable function error', err)
    return json({ success: false, message: 'Internal server error' }, 500)
  }
})

async function getRole(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .single()
  if (!error && data) return (data as { role?: string })?.role ?? null
  return null
}

type TimetableEntry = {
  id: string
  class_id: string
  course_id: string
  faculty_id: string
  day_of_week: number
  start_time: string
  end_time: string
  room: string | null
}

function groupByDay(entries: TimetableEntry[]): Record<number, TimetableEntry[]> {
  const grouped: Record<number, TimetableEntry[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  for (const entry of entries) {
    // Handle both camelCase (dayOfWeek) and snake_case (day_of_week)
    const day = (entry as any).dayOfWeek ?? entry.day_of_week ?? 0
    grouped[day] = grouped[day] || []
    grouped[day].push(entry)
  }
  return grouped
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
