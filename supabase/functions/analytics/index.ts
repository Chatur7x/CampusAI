// @ts-nocheck
// =============================================================
// CAMPUSAI - SUPABASE EDGE FUNCTION  
// Advanced Analytics & Reporting
// =============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type ReportType = 
  | 'attendance_summary'
  | 'department_analytics'
  | 'student_risk_analysis'
  | 'faculty_workload'
  | 'trend_analysis'
  | 'blockchain_audit'

interface AnalyticsRequest {
  reportType: ReportType
  filters?: {
    startDate?: string
    endDate?: string
    departmentId?: string
    classId?: string
    studentId?: string
    facultyId?: string
  }
  format?: 'json' | 'csv'
}

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

    // Verify user
    const authHeader = req.headers.get('Authorization')!
    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check role (admin/faculty only)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!profile || !['SUPER_ADMIN', 'ADMIN', 'FACULTY', 'CLASS_INCHARGE'].includes(profile.role)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body: AnalyticsRequest = await req.json()
    const { reportType, filters = {}, format = 'json' } = body
    
    let reportData: unknown

    switch (reportType) {
      case 'attendance_summary': {
        // Get overall attendance statistics
        const startDate = filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const endDate = filters.endDate || new Date().toISOString().split('T')[0]

        const { data: dailyStats } = await supabase
          .from('daily_attendance_summary')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: true })

        const { data: departmentStats } = await supabase
          .from('department_attendance_summary')
          .select('*')

        // Calculate aggregates
        const totalRecords = dailyStats?.reduce((sum, d) => sum + d.total_records, 0) || 0
        const totalPresent = dailyStats?.reduce((sum, d) => sum + d.present, 0) || 0
        const avgAttendance = totalRecords > 0 ? (totalPresent / totalRecords * 100).toFixed(2) : 0

        reportData = {
          period: { startDate, endDate },
          summary: {
            totalRecords,
            totalPresent,
            totalAbsent: dailyStats?.reduce((sum, d) => sum + d.absent, 0) || 0,
            totalLate: dailyStats?.reduce((sum, d) => sum + d.late, 0) || 0,
            averageAttendance: parseFloat(avgAttendance as string),
          },
          dailyTrend: dailyStats,
          byDepartment: departmentStats,
        }
        break
      }

      case 'department_analytics': {
        const departmentId = filters.departmentId

        let query = supabase
          .from('department_attendance_summary')
          .select('*')

        if (departmentId) {
          query = query.eq('department_id', departmentId)
        }

        const { data: deptStats } = await query

        // Get class breakdown
        const { data: classStats } = await supabase
          .from('classes')
          .select(`
            id,
            name,
            section,
            capacity,
            students:students(count)
          `)
          .eq(departmentId ? 'department_id' : 'is_active', departmentId || true)

        // Get faculty in department
        const { data: facultyList } = await supabase
          .from('faculty')
          .select(`
            id,
            employee_id,
            designation,
            profile:profiles(first_name, last_name)
          `)
          .eq(departmentId ? 'department_id' : 'is_active', departmentId || true)

        reportData = {
          departments: deptStats,
          classes: classStats,
          faculty: facultyList,
        }
        break
      }

      case 'student_risk_analysis': {
        // Find students at risk (low attendance, failing grades)
        const threshold = 75

        const { data: lowAttendance } = await supabase
          .from('student_attendance_overview')
          .select('*')
          .lt('attendance_percentage', threshold)
          .order('attendance_percentage', { ascending: true })

        // Categorize by risk level
        const critical = lowAttendance?.filter(s => s.attendance_percentage < 50) || []
        const high = lowAttendance?.filter(s => s.attendance_percentage >= 50 && s.attendance_percentage < 65) || []
        const medium = lowAttendance?.filter(s => s.attendance_percentage >= 65 && s.attendance_percentage < 75) || []

        // Get recent absences trend
        const { data: recentAbsences } = await supabase
          .from('attendance')
          .select('student_id, date, status')
          .eq('status', 'ABSENT')
          .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])

        // Count consecutive absences per student
        const consecutiveAbsences: Record<string, number> = {}
        recentAbsences?.forEach(a => {
          consecutiveAbsences[a.student_id] = (consecutiveAbsences[a.student_id] || 0) + 1
        })

        const frequentAbsentees = Object.entries(consecutiveAbsences)
          .filter(([_, count]) => count >= 3)
          .map(([studentId, count]) => ({ studentId, consecutiveDays: count }))

        reportData = {
          riskLevels: {
            critical: { count: critical.length, students: critical.slice(0, 20) },
            high: { count: high.length, students: high.slice(0, 20) },
            medium: { count: medium.length, students: medium.slice(0, 20) },
          },
          frequentAbsentees,
          totalAtRisk: lowAttendance?.length || 0,
          recommendations: [
            critical.length > 0 ? `${critical.length} students with critical attendance (<50%) need immediate intervention` : null,
            frequentAbsentees.length > 0 ? `${frequentAbsentees.length} students have been absent 3+ days this week` : null,
          ].filter(Boolean),
        }
        break
      }

      case 'faculty_workload': {
        const { data: facultyData } = await supabase
          .from('faculty')
          .select(`
            id,
            employee_id,
            designation,
            profile:profiles(first_name, last_name),
            timetable:timetable_entries(count),
            classes:classes!class_incharge_id(count)
          `)
          .eq('is_active', true)

        // Calculate workload metrics
        const workloadAnalysis = facultyData?.map(f => ({
          id: f.id,
          employeeId: f.employee_id,
          name: `${f.profile?.first_name} ${f.profile?.last_name}`,
          designation: f.designation,
          classesAssigned: (f.classes as unknown[])?.[0]?.count || 0,
          periodsPerWeek: (f.timetable as unknown[])?.[0]?.count || 0,
        }))

        const avgPeriods = workloadAnalysis?.reduce((sum, f) => sum + f.periodsPerWeek, 0) / (workloadAnalysis?.length || 1)

        reportData = {
          faculty: workloadAnalysis,
          summary: {
            totalFaculty: facultyData?.length || 0,
            averagePeriodsPerWeek: avgPeriods.toFixed(1),
            overloaded: workloadAnalysis?.filter(f => f.periodsPerWeek > avgPeriods * 1.3).length || 0,
            underutilized: workloadAnalysis?.filter(f => f.periodsPerWeek < avgPeriods * 0.7).length || 0,
          },
        }
        break
      }

      case 'trend_analysis': {
        const months = 6
        const startDate = new Date()
        startDate.setMonth(startDate.getMonth() - months)

        const { data: monthlyTrend } = await supabase
          .from('daily_attendance_summary')
          .select('date, attendance_percentage')
          .gte('date', startDate.toISOString().split('T')[0])
          .order('date', { ascending: true })

        // Group by month
        const byMonth: Record<string, { total: number; sum: number }> = {}
        monthlyTrend?.forEach(d => {
          const month = d.date.substring(0, 7)
          if (!byMonth[month]) byMonth[month] = { total: 0, sum: 0 }
          byMonth[month].total++
          byMonth[month].sum += d.attendance_percentage
        })

        const monthlyAverages = Object.entries(byMonth).map(([month, data]) => ({
          month,
          averageAttendance: (data.sum / data.total).toFixed(2),
          daysRecorded: data.total,
        }))

        // Day of week analysis
        const { data: dayOfWeekData } = await supabase.rpc('get_attendance_by_day_of_week')

        reportData = {
          monthlyTrend: monthlyAverages,
          dayOfWeekAnalysis: dayOfWeekData,
          insights: [
            // Auto-generate insights
          ],
        }
        break
      }

      case 'blockchain_audit': {
        // Verify blockchain integrity for all records
        const { data: students } = await supabase
          .from('students')
          .select('id, enrollment_id')
          .limit(100)

        const auditResults: { studentId: string; enrollmentId: string; valid: boolean; issues: string[] }[] = []

        for (const student of students || []) {
          const { data: records } = await supabase
            .from('attendance')
            .select('id, blockchain_hash, previous_hash, created_at')
            .eq('student_id', student.id)
            .order('created_at', { ascending: true })

          const issues: string[] = []
          let prevHash = 'GENESIS'

          for (const record of records || []) {
            if (record.previous_hash !== prevHash) {
              issues.push(`Chain broken at ${record.id}`)
            }
            prevHash = record.blockchain_hash || ''
          }

          auditResults.push({
            studentId: student.id,
            enrollmentId: student.enrollment_id,
            valid: issues.length === 0,
            issues,
          })
        }

        const validChains = auditResults.filter(r => r.valid).length
        const invalidChains = auditResults.filter(r => !r.valid)

        reportData = {
          summary: {
            totalStudentsAudited: auditResults.length,
            validChains,
            invalidChains: invalidChains.length,
            integrityScore: ((validChains / auditResults.length) * 100).toFixed(2) + '%',
          },
          issues: invalidChains,
          lastAuditAt: new Date().toISOString(),
        }
        break
      }

      default:
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid report type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Format response
    if (format === 'csv') {
      // Convert to CSV
      const csvData = convertToCSV(reportData)
      return new Response(csvData, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${reportType}_${new Date().toISOString().split('T')[0]}.csv"`,
        }
      })
    }

    return new Response(
      JSON.stringify({ success: true, data: reportData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Helper to convert data to CSV
function convertToCSV(data: unknown): string {
  if (Array.isArray(data)) {
    if (data.length === 0) return ''
    const headers = Object.keys(data[0])
    const rows = data.map(row => headers.map(h => JSON.stringify((row as Record<string, unknown>)[h] ?? '')).join(','))
    return [headers.join(','), ...rows].join('\n')
  }
  return JSON.stringify(data)
}
