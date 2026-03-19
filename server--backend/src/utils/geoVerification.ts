import { prisma } from './prisma';

// Campus configuration — update these for your actual campus
const CAMPUS_CONFIG = {
  latitude: 17.5023,     // Anurag University, Hyderabad approx lat
  longitude: 78.6068,    // Anurag University, Hyderabad approx lng
  radiusMeters: 500,     // 500m radius for campus boundary
  maxAccuracyMeters: 100, // reject GPS readings less accurate than 100m
};

/**
 * Haversine distance between two GPS coordinates (in meters)
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface GeoCheckResult {
  isWithinCampus: boolean;
  distanceMeters: number;
  spoofDetected: boolean;
  spoofReason: string | null;
}

/**
 * Verify if a GPS coordinate is within campus and detect spoofing
 */
export async function verifyLocation(
  userId: string,
  latitude: number,
  longitude: number,
  accuracy: number | null,
  attendanceId?: string
): Promise<GeoCheckResult> {
  const distance = haversineDistance(
    CAMPUS_CONFIG.latitude, CAMPUS_CONFIG.longitude,
    latitude, longitude
  );

  const is_within_campus = distance <= CAMPUS_CONFIG.radiusMeters;
  let spoof_detected = false;
  let spoof_reason: string | null = null;

  // Check 1: Accuracy too low (could be mocked GPS)
  if (accuracy !== null && accuracy > CAMPUS_CONFIG.maxAccuracyMeters) {
    spoof_detected = true;
    spoof_reason = `GPS accuracy too low: ${accuracy}m (max: ${CAMPUS_CONFIG.maxAccuracyMeters}m)`;
  }

  // Check 2: Velocity anomaly — if user's last geo check was recent but far away
  if (!spoof_detected) {
    const lastGeo = await prisma.geoVerification.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });

    if (lastGeo) {
      const timeDiffSeconds = (Date.now() - lastGeo.created_at.getTime()) / 1000;
      const distFromLast = haversineDistance(
        lastGeo.latitude, lastGeo.longitude,
        latitude, longitude
      );
      // Speed in m/s. Human max ~12 m/s (running), car ~40 m/s
      // If > 100 m/s in < 5 minutes, likely spoofed
      if (timeDiffSeconds > 0 && timeDiffSeconds < 300) {
        const speed = distFromLast / timeDiffSeconds;
        if (speed > 100) {
          spoof_detected = true;
          spoof_reason = `Impossible velocity: ${speed.toFixed(1)} m/s over ${timeDiffSeconds.toFixed(0)}s`;
        }
      }
    }
  }

  // Log the verification
  await prisma.geoVerification.create({
    data: {
      user_id: userId,
      latitude,
      longitude,
      accuracy,
      campus_distance: distance,
      is_within_campus,
      spoof_detected,
      spoof_reason,
      attendance_id: attendanceId,
    },
  });

  return {
    isWithinCampus: is_within_campus,
    distanceMeters: Math.round(distance),
    spoofDetected: spoof_detected,
    spoofReason: spoof_reason,
  };
}

/**
 * Get geo verification history for a user
 */
export async function getGeoHistory(userId: string, limit = 20) {
  return prisma.geoVerification.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    take: limit,
  });
}
