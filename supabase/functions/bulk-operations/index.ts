// =============================================================
// AISMS - SUPABASE EDGE FUNCTION
// Bulk Operations (Import Students, Mark Attendance, etc.)
// =============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type BulkOperation = 
  | 'import_students'
  | 'import_faculty'
  | 'bulk_attendance'
  | 'bulk_grades'
  | 'export_report'

interface BulkRequest {
  operation: BulkOperation
  data: Record<string, unknown>[]
  options?: {
    skipDuplicates?: boolean
    sendNotifications?: boolean
  }
}

interface BulkResponse {
  success: boolean
  processed: number
  failed: number
  errors: { row: number; error: string }[]
  message: string
}

// Generate cryptographically secure random password
function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
  const array = new Uint8Array(12)
  crypto.getRandomValues(array)
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(array[i] % chars.length)
  }
  return password
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

    // Verify admin role
    const authHeader = req.headers.get('Authorization')!
    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!profile || !['SUPER_ADMIN', 'ADMIN'].includes(profile.role)) {
      return new Response(
        JSON.stringify({ success: false, message: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body: BulkRequest = await req.json()
    const { operation, data, options = {} } = body
    const errors: { row: number; error: string }[] = []
    let processed = 0

    switch (operation) {
      case 'import_students': {
        for (let i = 0; i < data.length; i++) {
          const row = data[i] as {
            email: string
            firstName: string
            lastName: string
            enrollmentId: string
            departmentId: string
            classId: string
            batchYear: number
            semester?: number
            phone?: string
            guardianName?: string
            guardianPhone?: string
            guardianEmail?: string
          }

          try {
            // Check for existing user
            if (options.skipDuplicates) {
              const { data: existing } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', row.email)
                .single()
              
              if (existing) {
                errors.push({ row: i + 1, error: `Email already exists: ${row.email}` })
                continue
              }
            }

            // Create auth user
            const password = generatePassword()
            const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
              email: row.email,
              password,
              email_confirm: true,
              user_metadata: {
                first_name: row.firstName,
                last_name: row.lastName,
                role: 'STUDENT',
              }
            })

            if (authError) {
              errors.push({ row: i + 1, error: authError.message })
              continue
            }

            // Create profile
            await supabase.from('profiles').insert({
              user_id: authUser.user.id,
              email: row.email,
              role: 'STUDENT',
              first_name: row.firstName,
              last_name: row.lastName,
              phone: row.phone || null,
            })

            // Create student record
            await supabase.from('students').insert({
              user_id: authUser.user.id,
              enrollment_id: row.enrollmentId,
              department_id: row.departmentId,
              class_id: row.classId,
              batch_year: row.batchYear,
              semester: row.semester || 1,
              guardian_name: row.guardianName || null,
              guardian_phone: row.guardianPhone || null,
              guardian_email: row.guardianEmail || null,
            })

            // Send welcome email + in-app notification if enabled
            if (options.sendNotifications) {
              const appUrl = Deno.env.get('APP_URL') || 'https://campusai.app';
              const welcomeMsg = `Your CampusAI account has been created. Login at ${appUrl} with your email and the temporary password provided.`;

              // 1. In-app notification
              await supabase.from('notifications').insert({
                user_id: authUser.user.id,
                type: 'SYSTEM',
                title: 'Welcome to CampusAI',
                message: welcomeMsg,
                priority: 'MEDIUM',
              }).then(({ error }) => {
                if (error) console.warn(`Notification insert failed for ${row.email}:`, error.message);
              });

              // 2. Send welcome email via Resend (if RESEND_API_KEY is set)
              const resendKey = Deno.env.get('RESEND_API_KEY');
              if (resendKey) {
                try {
                  await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${resendKey}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      from: Deno.env.get('EMAIL_FROM') || 'CampusAI <noreply@campusai.app>',
                      to: [row.email],
                      subject: 'Welcome to CampusAI — Your Account is Ready',
                      html: `<h2>Welcome to CampusAI</h2>
                        <p>Hello ${row.firstName || 'Student'},</p>
                        <p>${welcomeMsg}</p>
                        <p><a href="${appUrl}/login">Login Now</a></p>
                        <p>— CampusAI Team</p>`,
                    }),
                  });
                } catch (emailErr) {
                  console.warn(`Welcome email failed for ${row.email}:`, emailErr);
                }
              }
            }

            processed++
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            errors.push({ row: i + 1, error: message })
          }
        }
        break
      }

      case 'import_faculty': {
        for (let i = 0; i < data.length; i++) {
          const row = data[i] as {
            email: string
            firstName: string
            lastName: string
            employeeId: string
            departmentId: string
            designation: string
            joiningDate: string
            specialization?: string
            qualifications?: string[]
            phone?: string
          }

          try {
            const password = generatePassword()
            const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
              email: row.email,
              password,
              email_confirm: true,
              user_metadata: {
                first_name: row.firstName,
                last_name: row.lastName,
                role: 'FACULTY',
              }
            })

            if (authError) {
              errors.push({ row: i + 1, error: authError.message })
              continue
            }

            await supabase.from('profiles').insert({
              user_id: authUser.user.id,
              email: row.email,
              role: 'FACULTY',
              first_name: row.firstName,
              last_name: row.lastName,
              phone: row.phone || null,
            })

            await supabase.from('faculty').insert({
              user_id: authUser.user.id,
              employee_id: row.employeeId,
              department_id: row.departmentId,
              designation: row.designation,
              joining_date: row.joiningDate,
              specialization: row.specialization || null,
              qualifications: row.qualifications || [],
            })

            processed++
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            errors.push({ row: i + 1, error: message })
          }
        }
        break
      }

      case 'bulk_attendance': {
        const records = data as {
          studentId: string
          date: string
          status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'
          subjectId?: string
        }[]

        const { error } = await supabase
          .from('attendance')
          .upsert(
            records.map(r => ({
              student_id: r.studentId,
              date: r.date,
              status: r.status,
              subject_id: r.subjectId || null,
              method: 'MANUAL',
              verified_by: user.id,
            })),
            { onConflict: 'student_id,date,subject_id' }
          )

        if (error) {
          errors.push({ row: 0, error: error.message })
        } else {
          processed = records.length
        }
        break
      }

      case 'bulk_grades': {
        const grades = data as {
          studentId: string
          subjectId: string
          semester: number
          internalMarks?: number
          externalMarks?: number
          grade?: string
        }[]

        for (let i = 0; i < grades.length; i++) {
          const grade = grades[i]
          try {
            // Calculate total and attendance impact
            const totalMarks = (grade.internalMarks || 0) + (grade.externalMarks || 0)
            
            // Get attendance percentage
            const { data: attendanceData } = await supabase.rpc('calculate_attendance_percentage', {
              p_student_id: grade.studentId
            })
            
            const attendancePercentage = attendanceData || 0
            let attendanceImpact = 0
            
            // Apply attendance penalty if below threshold
            if (attendancePercentage < 75) {
              attendanceImpact = Math.min(10, (75 - attendancePercentage) * 0.2)
            }

            await supabase.from('grades').upsert({
              student_id: grade.studentId,
              subject_id: grade.subjectId,
              semester: grade.semester,
              internal_marks: grade.internalMarks,
              external_marks: grade.externalMarks,
              total_marks: totalMarks,
              grade: grade.grade,
              attendance_percentage: attendancePercentage,
              attendance_impact: attendanceImpact,
            }, { onConflict: 'student_id,subject_id,semester' })

            processed++
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            errors.push({ row: i + 1, error: message })
          }
        }
        break
      }

      case 'export_report': {
        const { format = 'csv', reportType = 'attendance' } = (data[0] as Record<string, unknown>) || {};
        const reportData = data.length > 1 ? data.slice(1) : [];
        
        let csvContent = '';
        if (reportData.length > 0) {
          const headers = Object.keys(reportData[0] as Record<string, unknown>);
          csvContent = headers.join(',') + '\n';
          csvContent += reportData.map((row: unknown) => {
            return headers.map((h: string) => {
              const val = (row as Record<string, unknown>)[h];
              const str = val === null || val === undefined ? '' : String(val);
              return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
            }).join(',');
          }).join('\n');
        }

        const storagePath = `reports/${reportType}_${Date.now()}.${format}`;
        const { error: uploadError } = await supabase.storage
          .from('reports')
          .upload(storagePath, new TextEncoder().encode(csvContent), {
            contentType: format === 'csv' ? 'text/csv' : 'application/json',
            upsert: true,
          });

        if (uploadError) {
          errors.push({ row: 0, error: `Failed to upload report: ${uploadError.message}` });
        } else {
          const { data: urlData } = supabase.storage.from('reports').getPublicUrl(storagePath);
          processed = 1;
        }
        break
      }

      default:
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid operation' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'BULK_OPERATION',
      entity_type: operation,
      new_value: { processed, failed: errors.length, errors: errors.slice(0, 10) },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
    })

    const response: BulkResponse = {
      success: errors.length === 0,
      processed,
      failed: errors.length,
      errors: errors.slice(0, 50), // Limit error details
      message: `Processed ${processed} records. ${errors.length} failed.`
    }

    return new Response(
      JSON.stringify(response),
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
