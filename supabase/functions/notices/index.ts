// =============================================================
// AISMS - Supabase Edge Function
// Notices: list + create/update/delete + get by id (Supabase schema aligned)
// =============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN']
const CREATE_ROLES = ['ADMIN', 'SUPER_ADMIN', 'FACULTY']

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
      if (id) {
        const { data, error } = await supabase
          .from('notices')
          .select('*')
          .eq('id', id)
          .single()
        if (error) return json({ success: false, message: error.message }, 500)
        return json({ success: true, data })
      }

      const page = parseInt(url.searchParams.get('page') || '1', 10)
      const limit = parseInt(url.searchParams.get('limit') || '10', 10)
      const priority = url.searchParams.get('priority')
      const search = url.searchParams.get('search')

      const roleFilter = `{${role}}`
      let query = supabase
        .from('notices')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .or(`expiry_date.is.null,expiry_date.gte.${new Date().toISOString()}`)
        .or(`target_roles.cs.${roleFilter},target_roles.eq.{}`)
        .order('created_at', { ascending: false })

      if (priority) query = query.eq('priority', priority)
      if (search) {
        query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`)
      }

      query = query.range((page - 1) * limit, page * limit - 1)

      const { data, count, error } = await query
      if (error) return json({ success: false, message: error.message }, 500)

      return json({ success: true, data: { notices: data, pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) } } })
    }

    if (req.method === 'POST') {
      if (!CREATE_ROLES.includes(role)) return json({ success: false, message: 'Insufficient permissions' }, 403)
      const body = await req.json()
      const {
        title,
        content,
        priority = 'MEDIUM',
        targetRoles = [],
        targetDepartments = [],
        targetClasses = [],
        attachments = [],
        expiryDate,
        isPinned = false,
      } = body

      if (!title || !content) return json({ success: false, message: 'title and content are required' }, 400)

      const { data, error } = await supabase
        .from('notices')
        .insert({
          title,
          content,
          priority,
          target_roles: targetRoles,
          target_departments: targetDepartments,
          target_classes: targetClasses,
          attachments,
          expiry_date: expiryDate ? new Date(expiryDate).toISOString() : null,
          published_by: user.id,
          is_active: true,
          is_pinned: isPinned,
        })
        .select()
        .single()

      if (error) return json({ success: false, message: error.message }, 500)
      return json({ success: true, message: 'Notice created', data })
    }

    if (req.method === 'PUT') {
      if (!ADMIN_ROLES.includes(role)) return json({ success: false, message: 'Insufficient permissions' }, 403)
      if (!id) return json({ success: false, message: 'id is required' }, 400)
      const body = await req.json()

      const { data, error } = await supabase
        .from('notices')
        .update({
          ...body,
          target_roles: body.targetRoles ?? body.target_roles,
          target_departments: body.targetDepartments ?? body.target_departments,
          target_classes: body.targetClasses ?? body.target_classes,
          expiry_date: body.expiryDate ? new Date(body.expiryDate).toISOString() : body.expiry_date ?? null,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) return json({ success: false, message: error.message }, 500)
      return json({ success: true, message: 'Notice updated', data })
    }

    if (req.method === 'DELETE') {
      if (!ADMIN_ROLES.includes(role)) return json({ success: false, message: 'Insufficient permissions' }, 403)
      if (!id) return json({ success: false, message: 'id is required' }, 400)
      const { error } = await supabase
        .from('notices')
        .update({ is_active: false })
        .eq('id', id)
      if (error) return json({ success: false, message: error.message }, 500)
      return json({ success: true, message: 'Notice deleted' })
    }

    return json({ success: false, message: 'Method not allowed' }, 405)
  } catch (err) {
    console.error('Notices function error', err)
    return json({ success: false, message: 'Internal server error' }, 500)
  }
})

async function getRole(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .single()
  if (error) return null
  return (data as { role?: string })?.role ?? null
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
