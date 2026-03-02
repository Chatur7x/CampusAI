// @ts-nocheck
// =============================================================
// AISMS - Supabase Edge Function
// Attendance: fetch + manual mark (basic)
// =============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const ALLOWED_MARK_ROLES = ['ADMIN', 'SUPER_ADMIN', 'FACULTY', 'CLASS_INCHARGE']

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
    // Auth check
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

      const where: Record<string, unknown> = {}
      if (studentId) where['studentId'] = studentId
      if (classId) where['classId'] = classId
      if (subjectId) where['subjectId'] = subjectId
      if (startDate || endDate) {
        where['date'] = {}
        if (startDate) where['date']['gte'] = startDate
        if (endDate) where['date']['lte'] = endDate
      }

      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .match(where)
        .order('date', { ascending: false })

      if (error) return json({ success: false, message: error.message }, 500)

      // Simple stats
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
      const { studentId, status, subjectId, justification } = body
      if (!studentId || !status) {
        return json({ success: false, message: 'studentId and status are required' }, 400)
      }

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { data, error } = await supabase
        .from('attendance')
        .upsert({
          studentId,
          subjectId: subjectId ?? null,
          date: today.toISOString().split('T')[0],
          status,
          method: 'MANUAL',
          verifiedBy: user.id,
          justification: justification ?? null,
        }, { onConflict: 'studentId,date,subjectId' })
        .select()
        .single()

      if (error) return json({ success: false, message: error.message }, 500)

      return json({ success: true, message: 'Attendance marked', data })
    }

    return json({ success: false, message: 'Method not allowed' }, 405)
  } catch (err) {
    console.error('Attendance function error', err)
    return json({ success: false, message: 'Internal server error' }, 500)
  }
})

async function getRole(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()
  if (error) return null
  return data?.role ?? null
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
