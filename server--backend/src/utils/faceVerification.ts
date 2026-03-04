import { env } from '../config/env';

export interface FaceVerificationResult {
  isMatch: boolean;
  confidence: number;
  livenessScore?: number;
}

/**
 * Delegates face verification to an external service. This avoids any dummy/random matching.
 * The external service should accept JSON { storedFaceData, providedFaceData } and respond with
 * { isMatch: boolean, confidence: number, livenessScore?: number }.
 */
export const verifyFaceExternal = async (
  storedFaceData: string,
  providedFaceData: string
): Promise<FaceVerificationResult> => {
  if (!env.faceVerificationEndpoint) {
    throw new Error('Face verification service is not configured');
  }

  const response = await fetch(env.faceVerificationEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(env.faceVerificationApiKey ? { Authorization: `Bearer ${env.faceVerificationApiKey}` } : {}),
    },
    body: JSON.stringify({ storedFaceData, providedFaceData }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Face verification failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as FaceVerificationResult;
  if (typeof data.confidence !== 'number' || typeof data.isMatch !== 'boolean') {
    throw new Error('Face verification service returned invalid payload');
  }

  return {
    isMatch: data.isMatch,
    confidence: data.confidence,
    livenessScore: data.livenessScore,
  };
};
