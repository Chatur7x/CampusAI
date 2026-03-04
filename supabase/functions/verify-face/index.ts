/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// =============================================================
// CAMPUSAI - SUPABASE EDGE FUNCTION
// AI-Powered Face Recognition Attendance
// =============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface FaceVerificationRequest {
  studentId: string
  faceEmbedding: number[]
  location?: {
    lat: number
    lng: number
    accuracy: number
  }
  deviceInfo?: string
  subjectId?: string
  timetableEntryId?: string
}

interface FaceVerificationResponse {
  success: boolean
  verified: boolean
  confidenceScore: number
  attendanceId?: string
  securityAlert?: boolean
  message: string
}

// Cosine similarity for face embedding comparison
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Check if location is within campus bounds
function isWithinCampus(lat: number, lng: number, campusConfig: { 
  centerLat: number
  centerLng: number
  radiusMeters: number 
}): boolean {
  const R = 6371000 // Earth's radius in meters
  const dLat = (lat - campusConfig.centerLat) * Math.PI / 180
  const dLng = (lng - campusConfig.centerLng) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(campusConfig.centerLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  const distance = R * c
  
  return distance <= campusConfig.radiusMeters
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Get user from JWT
    const authHeader = req.headers.get('Authorization')!
    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body: FaceVerificationRequest = await req.json()
    const { studentId, faceEmbedding, location, deviceInfo, subjectId, timetableEntryId } = body

    // Get student data
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*, profile:profiles(*)')
      .eq('id', studentId)
      .single()

    if (studentError || !student) {
      return new Response(
        JSON.stringify({ success: false, message: 'Student not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the requesting user is the student
    if (student.user_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, message: 'Unauthorized student' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if face is registered
    if (!student.face_registered || !student.face_data) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          verified: false,
          confidenceScore: 0,
          message: 'Face not registered. Please register your face first.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get system settings
    const { data: settings } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['face_confidence_threshold', 'geolocation_radius'])

    const confidenceThreshold = settings?.find(s => s.key === 'face_confidence_threshold')?.value?.min ?? 0.85
    const geoConfig = settings?.find(s => s.key === 'geolocation_radius')?.value ?? { meters: 500 }

    // Parse stored face data
    const storedEmbedding = JSON.parse(student.face_data) as number[]
    
    // Calculate similarity
    const similarityScore = cosineSimilarity(faceEmbedding, storedEmbedding)
    const isVerified = similarityScore >= confidenceThreshold

    let securityAlert = false
    let alertReason = ''

    // Check for geo-location anomaly
    if (location) {
      // TODO: Get campus coordinates from settings
      const campusConfig = { centerLat: 0, centerLng: 0, radiusMeters: geoConfig.meters }
      const inCampus = isWithinCampus(location.lat, location.lng, campusConfig)
      
      if (!inCampus && isVerified) {
        securityAlert = true
        alertReason = 'Attendance marked from outside campus boundaries'
      }
    }

    // Check for face mismatch
    if (!isVerified && similarityScore > 0.5) {
      securityAlert = true
      alertReason = `Face mismatch detected (similarity: ${(similarityScore * 100).toFixed(1)}%)`
    }

    // Create security alert if needed
    if (securityAlert) {
      await supabase.from('security_alerts').insert({
        type: isVerified ? 'geo_anomaly' : 'face_mismatch',
        severity: isVerified ? 'MEDIUM' : 'HIGH',
        user_id: user.id,
        description: alertReason,
        data: {
          student_id: studentId,
          confidence_score: similarityScore,
          location,
          device_info: deviceInfo,
        }
      })
    }

    // If verified, mark attendance
    let attendanceId: string | undefined
    if (isVerified) {
      const today = new Date().toISOString().split('T')[0]
      
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance')
        .upsert({
          student_id: studentId,
          subject_id: subjectId,
          timetable_entry_id: timetableEntryId,
          date: today,
          status: 'PRESENT',
          method: 'AI_FACE',
          confidence_score: similarityScore,
          location: location ? { lat: location.lat, lng: location.lng, accuracy: location.accuracy } : null,
          device_info: deviceInfo,
          ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
        }, {
          onConflict: 'student_id,date,subject_id'
        })
        .select()
        .single()

      if (attendanceError) {
        console.error('Attendance error:', attendanceError)
      } else {
        attendanceId = attendance?.id
      }
    }

    const response: FaceVerificationResponse = {
      success: true,
      verified: isVerified,
      confidenceScore: similarityScore,
      attendanceId,
      securityAlert,
      message: isVerified 
        ? 'Attendance marked successfully' 
        : 'Face verification failed. Please try again or contact admin.'
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
