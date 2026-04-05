// =============================================================
// AISMS - SUPABASE EDGE FUNCTION  
// Security Monitoring & Automated Cleanup
// =============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface SecurityAction {
  action: 'cleanup' | 'scan' | 'stats' | 'lockout-check'
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

    const body: SecurityAction = await req.json()
    const { action } = body

    switch (action) {
      // ── Cleanup expired tokens & old logs ──────────────────
      case 'cleanup': {
        const now = new Date().toISOString()

        // Remove expired blacklisted tokens
        const { count: tokenCount } = await supabase
          .from('token_blacklist')
          .delete()
          .lt('expires_at', now)

        // Remove API request logs older than 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const { count: logCount } = await supabase
          .from('api_request_log')
          .delete()
          .lt('created_at', thirtyDaysAgo)

        // Remove login history older than 90 days
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
        const { count: loginCount } = await supabase
          .from('login_history')
          .delete()
          .lt('created_at', ninetyDaysAgo)

        return new Response(
          JSON.stringify({
            success: true,
            action: 'cleanup',
            results: {
              expiredTokensRemoved: tokenCount ?? 0,
              oldLogsRemoved: logCount ?? 0,
              oldLoginHistoryRemoved: loginCount ?? 0,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // ── Brute force & anomaly scan ─────────────────────────
      case 'scan': {
        const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

        // Find IPs with >5 failed logins in last 15 min
        const { data: failedLogins } = await supabase
          .from('login_history')
          .select('ip_address')
          .eq('status', 'failed')
          .gte('created_at', fifteenMinAgo)

        const ipCounts: Record<string, number> = {}
        for (const row of failedLogins ?? []) {
          if (row.ip_address) {
            ipCounts[row.ip_address] = (ipCounts[row.ip_address] || 0) + 1
          }
        }

        const suspiciousIPs = Object.entries(ipCounts)
          .filter(([, count]) => count >= 5)
          .map(([ip, count]) => ({ ip, failedAttempts: count }))

        // Log security events for suspicious IPs
        for (const { ip, failedAttempts } of suspiciousIPs) {
          await supabase.from('security_events').insert({
            event_type: 'brute_force',
            severity: 'HIGH',
            description: `Brute force detected: ${failedAttempts} failed logins from IP ${ip} in 15 min`,
            ip_address: ip,
            metadata: { failed_attempts: failedAttempts },
            resolved: false,
          })
        }

        // Check for geo spoofing — impossible travel (login from 2 locations >500km apart within 30 min)
        const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
        const { data: recentGeo } = await supabase
          .from('geo_verifications')
          .select('user_id, latitude, longitude, created_at')
          .gte('created_at', thirtyMinAgo)
          .order('created_at', { ascending: true })

        const geoByUser: Record<string, Array<{ lat: number; lng: number; time: string }>> = {}
        for (const g of recentGeo ?? []) {
          if (!geoByUser[g.user_id]) geoByUser[g.user_id] = []
          geoByUser[g.user_id].push({ lat: g.latitude, lng: g.longitude, time: g.created_at })
        }

        const travelAnomalies: string[] = []
        for (const [userId, points] of Object.entries(geoByUser)) {
          for (let i = 1; i < points.length; i++) {
            const dist = haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng)
            const timeDiffMs = new Date(points[i].time).getTime() - new Date(points[i - 1].time).getTime()
            const speed = dist / (timeDiffMs / 1000) // m/s
            if (speed > 100) { // >100 m/s is impossible human travel
              travelAnomalies.push(userId)
              await supabase.from('security_events').insert({
                event_type: 'geo_anomaly',
                severity: 'HIGH',
                description: `Impossible travel detected for user: ${dist.toFixed(0)}m in ${(timeDiffMs / 1000).toFixed(0)}s (${speed.toFixed(1)} m/s)`,
                user_id: userId,
                metadata: { distance_m: dist, time_diff_s: timeDiffMs / 1000, speed_ms: speed },
                resolved: false,
              })
            }
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            action: 'scan',
            results: {
              suspiciousIPs,
              travelAnomalies,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // ── Dashboard stats ────────────────────────────────────
      case 'stats': {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

        const [
          { count: openEvents },
          { count: criticalEvents },
          { count: failedLogins },
          { count: successLogins },
          { count: totalDevices },
          { data: recentEvents },
        ] = await Promise.all([
          supabase.from('security_events').select('*', { count: 'exact', head: true }).eq('resolved', false),
          supabase.from('security_events').select('*', { count: 'exact', head: true }).eq('severity', 'CRITICAL').eq('resolved', false),
          supabase.from('login_history').select('*', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', oneDayAgo),
          supabase.from('login_history').select('*', { count: 'exact', head: true }).eq('status', 'success').gte('created_at', oneDayAgo),
          supabase.from('trusted_devices').select('*', { count: 'exact', head: true }).eq('is_trusted', true),
          supabase.from('security_events').select('*').gte('created_at', sevenDaysAgo).order('created_at', { ascending: false }).limit(20),
        ])

        return new Response(
          JSON.stringify({
            success: true,
            action: 'stats',
            data: {
              openEvents: openEvents ?? 0,
              criticalEvents: criticalEvents ?? 0,
              failedLogins24h: failedLogins ?? 0,
              successfulLogins24h: successLogins ?? 0,
              trustedDeviceCount: totalDevices ?? 0,
              recentEvents: recentEvents ?? [],
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // ── Auto-unlock accounts past lockout window ───────────
      case 'lockout-check': {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

        // Find users locked more than 1 hour ago
        const { data: lockedUsers } = await supabase
          .from('profiles')
          .select('user_id, email')
          .eq('account_locked', true)
          .lt('locked_at', oneHourAgo)

        let unlocked = 0
        for (const user of lockedUsers ?? []) {
          await supabase
            .from('profiles')
            .update({ account_locked: false, locked_at: null, failed_login_attempts: 0 })
            .eq('user_id', user.user_id)

          await supabase.from('security_events').insert({
            event_type: 'account_unlocked',
            severity: 'LOW',
            description: `Account auto-unlocked after lockout period: ${user.email}`,
            user_id: user.user_id,
            resolved: true,
          })
          unlocked++
        }

        return new Response(
          JSON.stringify({
            success: true,
            action: 'lockout-check',
            results: { accountsUnlocked: unlocked },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ── Haversine distance helper (meters) ─────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
