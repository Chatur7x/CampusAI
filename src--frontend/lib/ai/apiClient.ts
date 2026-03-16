// =============================================================
// CampusAI — Python Backend API Client
// Replaces all local TypeScript AI modules with REST calls
// to the FastAPI Python server running on localhost:8000
// =============================================================

const AI_BASE = import.meta.env.VITE_AI_SERVER_URL || 'http://localhost:8000';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${AI_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `AI server error ${res.status}`);
  }
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${AI_BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `AI server error ${res.status}`);
  }
  return res.json();
}

// =====================================================================
// 1. Face Recognition
// =====================================================================

export interface RegisterFaceRequest {
  user_id: string;
  images: string[];  // base64 data-URLs
}

export interface RegisterFaceResponse {
  success: boolean;
  student_id: string;
  images_processed: number;
  errors?: string[];
}

export async function registerFace(
  userId: string,
  photos: { imageData: string; angle: string }[],
  livenessFrames: string[],
  challengeType?: string
): Promise<RegisterFaceResponse> {
  return post('/api/face/register', { user_id: userId, photos, liveness_frames: livenessFrames, challenge_type: challengeType });
}

export interface VerifyFaceRequest {
  user_id: string;
  image: string;
  liveness_frames?: string[];
  latitude?: number;
  longitude?: number;
  accuracy_m?: number;
  device_fingerprint?: string;
  session_code?: string;
  class_id?: string;
}

export interface VerifyFaceResponse {
  match: { match: boolean; similarity: number; threshold: number; error?: string };
  liveness: { is_live: boolean; liveness_score?: number; avg_liveness_score?: number; blink_detected?: boolean };
  geo: { valid: boolean; distance_m: number; geo_accuracy: number };
  confidence: {
    score: number;
    category: string;
    auto_approved: boolean;
    breakdown: Record<string, unknown>;
    flags?: string[];
  };
}

export async function verifyFace(req: VerifyFaceRequest): Promise<VerifyFaceResponse> {
  return post('/api/face/verify', req);
}

export interface IdentifyFaceResponse {
  identified: boolean;
  student_id?: string;
  similarity?: number;
  liveness?: Record<string, unknown>;
  geo?: Record<string, unknown>;
}

export async function identifyFace(
  image: string,
  classId?: string,
  livenessFrames?: string[],
  lat?: number,
  lon?: number,
): Promise<IdentifyFaceResponse> {
  return post('/api/face/identify', {
    image,
    class_id: classId,
    liveness_frames: livenessFrames,
    latitude: lat,
    longitude: lon,
  });
}

export interface LivenessResponse {
  is_live: boolean;
  liveness_score?: number;
  avg_liveness_score?: number;
  blink_detected?: boolean;
  blink_count?: number;
  head_movement_detected?: boolean;
  ear_left?: number;
  ear_right?: number;
  head_pose?: { yaw: number; pitch: number; roll: number };
  texture_score?: number;
}

export async function checkLiveness(frames: string[]): Promise<LivenessResponse> {
  return post('/api/face/liveness', { frames });
}

export interface LivenessChallenge {
  challenge: { type: string; instruction: string; timeout_s: number } | null;
  required: boolean;
  challenge_id?: string;
}

export async function getLivenessChallenge(): Promise<LivenessChallenge> {
  return post('/api/face/challenge', {});
}

// =====================================================================
// 2. Attendance — Risk, Trend, Fraud, Geo, Confidence
// =====================================================================

export interface RiskResult {
  risk_score: number;
  method: string;
  category: string;
}

export async function predictRisk(data: {
  student_id: string;
  attendance_pct: number;
  consecutive_absences?: number;
  late_count?: number;
  monthly_trend?: number;
}): Promise<RiskResult> {
  return post('/api/attendance/risk', data);
}

export interface TrendResult {
  method: string;
  predictions: number[];
  trend: string;
  slope?: number;
  intercept?: number;
  r_squared?: number;
  aic?: number;
}

export async function predictTrend(weeklyRates: number[], forecastWeeks = 4): Promise<TrendResult> {
  return post('/api/attendance/trend', { weekly_rates: weeklyRates, forecast_weeks: forecastWeeks });
}

export interface FraudResult {
  fraud_score: number;
  is_fraudulent: boolean;
  flags: string[];
  details: Record<string, unknown>;
  severity: string;
}

export async function checkFraud(data: {
  distance_from_campus?: number;
  hour_of_day?: number;
  day_of_week?: number;
  attendance_pct?: number;
  face_similarity?: number;
  liveness_score?: number;
  device_fingerprint?: string;
  known_devices?: string[];
}): Promise<FraudResult> {
  return post('/api/attendance/fraud', data);
}

export interface GeoResult {
  valid: boolean;
  distance_m: number;
  radius_m: number;
  geo_accuracy: number;
  spoofing: { spoofing_suspected: boolean; flags: string[] };
}

export async function validateGeo(
  lat: number,
  lon: number,
  accuracyM = 0,
  prevLat?: number,
  prevLon?: number,
  timeDeltaS?: number,
  isMock = false,
): Promise<GeoResult> {
  return post('/api/attendance/geo/validate', {
    latitude: lat,
    longitude: lon,
    accuracy_m: accuracyM,
    prev_latitude: prevLat,
    prev_longitude: prevLon,
    time_delta_s: timeDeltaS,
    is_mock: isMock,
  });
}

export interface ConfidenceResult {
  score: number;
  category: string;
  auto_approved: boolean;
  breakdown: Record<string, unknown>;
}

export async function computeConfidence(
  faceSimilarity: number,
  livenessScore: number,
  geoAccuracy: number,
): Promise<ConfidenceResult> {
  return post('/api/attendance/confidence', {
    face_similarity: faceSimilarity,
    liveness_score: livenessScore,
    geo_accuracy: geoAccuracy,
  });
}

// =====================================================================
// 3. Analytics — Correlation, Profiling, Monitoring
// =====================================================================

export interface CorrelationResult {
  r: number;
  p_value: number;
  significant: boolean;
  strength: string;
  direction: string;
  interpretation: string;
  sample_size: number;
}

export async function getCorrelation(
  attendances: number[],
  grades: number[],
): Promise<CorrelationResult> {
  return post('/api/analytics/correlation', { attendances, grades });
}

export interface GradePrediction {
  predicted_grade: number;
  confidence_interval: { lower: number; upper: number };
  model: { slope: number; intercept: number; r_squared: number };
  input_attendance: number;
}

export async function predictGrade(
  attendancePct: number,
  historicalAttendances: number[],
  historicalGrades: number[],
): Promise<GradePrediction> {
  return post('/api/analytics/predict-grade', {
    attendance_pct: attendancePct,
    historical_attendances: historicalAttendances,
    historical_grades: historicalGrades,
  });
}

export interface ProfileResult {
  profile: string;
  cluster_id: number;
  confidence: number;
  method: string;
}

export async function classifyProfile(data: {
  attendance_pct: number;
  absence_streak_max?: number;
  late_pct?: number;
  variance_weekly?: number;
  student_id?: string;
}): Promise<ProfileResult> {
  return post('/api/analytics/profiles/classify', data);
}

export async function batchClassifyProfiles(records: Record<string, unknown>[]): Promise<ProfileResult[]> {
  return post('/api/analytics/profiles/batch', { records });
}

export interface ModelHealth {
  model: string;
  total_predictions: number;
  accuracy_drift: {
    drift_detected: boolean;
    baseline_avg?: number;
    current_avg?: number;
    drop?: number;
  };
  status: string;
}

export async function getModelHealth(): Promise<ModelHealth[]> {
  return get('/api/analytics/monitoring/health');
}

export async function getSingleModelHealth(modelName: string): Promise<ModelHealth> {
  return get(`/api/analytics/monitoring/health/${modelName}`);
}

// =====================================================================
// Health check
// =====================================================================

export async function healthCheck(): Promise<{ status: string; service: string }> {
  return get('/health');
}

// =====================================================================
// Utility: get location (browser geolocation API)
// =====================================================================

export function getCurrentLocation(timeoutMs = 15000): Promise<{ latitude: number; longitude: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(new Error(`Geolocation error: ${err.message}`)),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

// =====================================================================
// Utility: capture frame from video element as base64
// =====================================================================

export function captureFrame(video: HTMLVideoElement, quality = 0.85): string {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0);
  return canvas.toDataURL('image/jpeg', quality);
}
