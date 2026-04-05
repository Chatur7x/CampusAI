// =============================================================
// AISMS - SUPABASE EDGE FUNCTION  
// Smart Notifications & Alerts System
// =============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type NotificationType = 
  | 'low_attendance_alert'
  | 'class_reminder'
  | 'leave_status'
  | 'exam_reminder'
  | 'system_announcement'
  | 'security_alert'
  | 'custom'

interface NotificationRequest {
  type: NotificationType
  payload: Record<string, unknown>
  channels?: ('push' | 'email' | 'sms' | 'in_app')[]
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

    const body: NotificationRequest = await req.json()
    const { type, payload, channels = ['in_app'] } = body
    
    const results: { channel: string; success: boolean; message?: string }[] = []

    switch (type) {
      case 'low_attendance_alert': {
        // Find students with attendance below threshold
        const threshold = (payload.threshold as number) || 75

        const { data: atRiskStudents } = await supabase
          .from('student_attendance_overview')
          .select(`
            student_id,
            full_name,
            enrollment_id,
            attendance_percentage,
            class_id,
            department_name
          `)
          .lt('attendance_percentage', threshold)

        for (const student of (atRiskStudents || []) as Array<Record<string, unknown>>) {
          const studentId = student.student_id as string;
          const attendancePct = student.attendance_percentage as number;
          const message = `⚠️ Attendance Alert: Your current attendance is ${Number(attendancePct).toFixed(1)}%, which is below the required ${threshold}%. Please ensure regular attendance to avoid academic consequences.`

          // Create in-app notification
          if (channels.includes('in_app')) {
            await supabase.from('notifications').insert({
              user_id: studentId,
              type: 'ATTENDANCE_ALERT',
              title: 'Low Attendance Warning',
              message,
              priority: attendancePct < 50 ? 'CRITICAL' : 'HIGH',
              action_url: '/student/attendance',
            })
          }

          // Notify class incharge and parents
          await notifyGuardians(supabase, studentId, message)
        }

        results.push({
          channel: 'all',
          success: true,
          message: `Sent alerts to ${atRiskStudents?.length || 0} students`,
        })
        break
      }

      case 'class_reminder': {
        // Send reminders for upcoming classes
        const minutesBefore = (payload.minutesBefore as number) || 15

        const now = new Date()
        const reminderTime = new Date(now.getTime() + minutesBefore * 60000)
        const currentDay = now.getDay()
        const targetTime = reminderTime.toTimeString().substring(0, 5)

        const { data: upcomingClasses } = await supabase
          .from('timetable_entries')
          .select(`
            id,
            class:classes(id, name, section),
            course:courses(id, name, code),
            faculty:faculty(id, employee_id, profile:profiles(first_name, last_name)),
            start_time,
            end_time,
            room
          `)
          .eq('day_of_week', currentDay)
          .gte('start_time', targetTime)
          .lte('start_time', targetTime.substring(0, 4) + '9')

        for (const entry of (upcomingClasses || []) as Array<Record<string, unknown>>) {
          const classData = entry.class as { id?: string; name?: string; section?: string } | undefined;
          const courseData = entry.course as { id?: string; name?: string; code?: string } | undefined;
          const facultyData = entry.faculty as { id?: string; employee_id?: string; profile?: { first_name?: string; last_name?: string } } | undefined;
          
          const classId = classData?.id;
          const message = `📚 Class Reminder: ${courseData?.name ?? 'Class'} (${courseData?.code ?? ''}) starts in ${minutesBefore} minutes in ${entry.room}.`

          if (classId) {
            const { data: students } = await supabase
              .from('students')
              .select('id')
              .eq('class_id', classId)

            for (const student of (students || []) as Array<{ id: string }>) {
              await supabase.from('notifications').insert({
                user_id: student.id,
                type: 'CLASS_REMINDER',
                title: 'Upcoming Class',
                message,
                priority: 'MEDIUM',
              })
            }
          }

          if (facultyData?.id) {
            await supabase.from('notifications').insert({
              user_id: facultyData.id,
              type: 'CLASS_REMINDER',
              title: 'Class Starting Soon',
              message: `Your ${courseData?.name ?? 'class'} in ${entry.room} starts in ${minutesBefore} minutes.`,
              priority: 'MEDIUM',
            })
          }
        }

        results.push({
          channel: 'in_app',
          success: true,
          message: `Sent reminders for ${upcomingClasses?.length || 0} classes`,
        })
        break
      }

      case 'leave_status': {
        const { leaveId, status, remarks } = payload as { leaveId: string; status: string; remarks?: string }

        const { data: leave } = await supabase
          .from('leave_requests')
          .select('*, student:students(id)')
          .eq('id', leaveId)
          .single()

        if (leave) {
          const studentData = leave.student as { id: string } | undefined;
          const studentId = studentData?.id;
          
          if (studentId) {
            const statusEmoji = status === 'APPROVED' ? '✅' : status === 'REJECTED' ? '❌' : '⏳'
            const message = `${statusEmoji} Leave Request ${status}: Your ${leave.type} leave from ${leave.start_date} to ${leave.end_date} has been ${status.toLowerCase()}.${remarks ? ` Remarks: ${remarks}` : ''}`

            await supabase.from('notifications').insert({
              user_id: studentId,
              type: 'LEAVE_STATUS',
              title: `Leave ${status}`,
              message,
              priority: 'HIGH',
            })
          }

          results.push({ channel: 'all', success: true, message: 'Leave notification sent' })
        }
        break
      }

      case 'exam_reminder': {
        const { examDate, examType, courseName, classId, daysBeforeReminders } = payload as {
          examDate: string
          examType: string
          courseName: string
          classId: string
          daysBeforeReminders: number[]
        }

        const examDateObj = new Date(examDate)
        const today = new Date()
        const daysUntilExam = Math.ceil((examDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        if (daysBeforeReminders.includes(daysUntilExam)) {
          const { data: students } = await supabase
            .from('students')
            .select('id')
            .eq('class_id', classId)

          const message = `📝 Exam Alert: Your ${examType} for ${courseName} is in ${daysUntilExam} day${daysUntilExam > 1 ? 's' : ''} (${examDate}). Good luck with your preparation!`

          for (const student of (students || []) as Array<{ id: string }>) {
            await supabase.from('notifications').insert({
              user_id: student.id,
              type: 'EXAM_REMINDER',
              title: 'Exam Reminder',
              message,
              priority: daysUntilExam <= 1 ? 'CRITICAL' : 'HIGH',
            })
          }

          results.push({
            channel: 'in_app',
            success: true,
            message: `Sent exam reminders to ${students?.length || 0} students`,
          })
        }
        break
      }

      case 'system_announcement': {
        const { title, message, targetRoles, targetDepartments, priority } = payload as {
          title: string
          message: string
          targetRoles?: string[]
          targetDepartments?: string[]
          priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
        }

        let query = supabase.from('profiles').select('user_id, role')

        if (targetRoles?.length) {
          query = query.in('role', targetRoles)
        }

        const { data: users } = await query

        // Filter by department if specified
        let targetUsers = users || []
        if (targetDepartments?.length) {
          const { data: deptUsers } = await supabase
            .from('students')
            .select('id, department_id')
            .in('department_id', targetDepartments)

          const { data: deptFaculty } = await supabase
            .from('faculty')
            .select('id, department_id')
            .in('department_id', targetDepartments)

          const deptUserIds = new Set([
            ...(deptUsers?.map(u => u.id) || []),
            ...(deptFaculty?.map(u => u.id) || []),
          ])

          targetUsers = targetUsers.filter(u => deptUserIds.has(u.user_id))
        }

        const notifications = targetUsers.map(user => ({
          user_id: user.user_id,
          type: 'SYSTEM' as const,
          title,
          message,
          priority,
        }))

        if (notifications.length > 0) {
          await supabase.from('notifications').insert(notifications)
        }

        results.push({
          channel: 'in_app',
          success: true,
          message: `Announcement sent to ${notifications.length} users`,
        })
        break
      }

      case 'security_alert': {
        const { alertType, severity, description, userId, metadata } = payload as {
          alertType: string
          severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
          description: string
          userId?: string
          metadata?: Record<string, unknown>
        }

        // Log security alert
        await supabase.from('security_alerts').insert({
          alert_type: alertType,
          severity,
          description,
          user_id: userId,
          ip_address: metadata?.ipAddress as string,
          user_agent: metadata?.userAgent as string,
          payload: metadata,
        })

        // Notify all admins for high/critical alerts
        if (['HIGH', 'CRITICAL'].includes(severity)) {
          const { data: admins } = await supabase
            .from('profiles')
            .select('user_id')
            .in('role', ['SUPER_ADMIN', 'ADMIN'])

          const notifications = (admins || []).map(admin => ({
            user_id: admin.user_id,
            type: 'SECURITY' as const,
            title: `🚨 Security Alert: ${alertType}`,
            message: description,
            priority: severity,
          }))

          if (notifications.length > 0) {
            await supabase.from('notifications').insert(notifications)
          }

          results.push({
            channel: 'in_app',
            success: true,
            message: `Security alert logged and ${notifications.length} admins notified`,
          })
        }
        break
      }

      case 'custom': {
        const { userId, title, message, priority = 'MEDIUM' } = payload as {
          userId: string
          title: string
          message: string
          priority?: string
        }

        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'CUSTOM',
          title,
          message,
          priority,
        })

        results.push({ channel: 'in_app', success: true, message: 'Custom notification sent' })
        break
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
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

// Helper functions
async function sendEmail(options: { to: string; subject: string; body: string }) {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    // No email provider configured — log and skip
    console.warn('[sendEmail] RESEND_API_KEY not set, skipping email to:', options.to)
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('EMAIL_FROM') || 'CampusAI <noreply@campusai.app>',
        to: [options.to],
        subject: options.subject,
        html: options.body.replace(/\n/g, '<br>'),
      }),
    })
    if (!res.ok) {
      console.warn('[sendEmail] Resend API error:', await res.text())
      return false
    }
    return true
  } catch (err) {
    console.warn('[sendEmail] Failed:', err)
    return false
  }
}

async function notifyGuardians(supabase: unknown, studentId: string, message: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data } = await client
    .from('students')
    .select('guardian_name, guardian_phone, guardian_email')
    .eq('id', studentId)
    .single()

  if (data?.guardian_email) {
    await sendEmail({
      to: data.guardian_email,
      subject: 'Student Attendance Alert',
      body: `Dear ${data.guardian_name ?? 'Parent/Guardian'},\n\n${message}\n\nPlease ensure your ward maintains regular attendance.\n\nRegards,\nAISMS Team`,
    })
  }
}
