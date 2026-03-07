import dotenv from 'dotenv';

// Load environment variables before validating
dotenv.config();

const requiredEnv = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'FRONTEND_URL',
];

const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length > 0) {
  // Fail fast so misconfiguration is obvious in development
  // In production you may want to log and exit instead of throwing
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

export const env = {
  databaseUrl: process.env.DATABASE_URL as string,
  jwtSecret: process.env.JWT_SECRET as string,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET as string,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  faceConfidenceThreshold: parseFloat(process.env.FACE_CONFIDENCE_THRESHOLD || '0.6'),
  blockchainDifficulty: parseInt(process.env.BLOCKCHAIN_DIFFICULTY || '4', 10),
  blockchainSalt: (() => {
    const salt = process.env.BLOCKCHAIN_SALT || 'change-me';
    if (salt === 'change-me') {
      console.warn('⚠️  BLOCKCHAIN_SALT is using the insecure default. Set a unique value in .env');
    }
    return salt;
  })(),
  faceVerificationEndpoint: process.env.FACE_VERIFICATION_ENDPOINT,
  faceVerificationApiKey: process.env.FACE_VERIFICATION_API_KEY,
  smtp: {
    host: process.env.SMTP_HOST as string,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER as string,
    pass: process.env.SMTP_PASS as string,
    from: process.env.FROM_EMAIL || 'no-reply@example.com',
  },
  frontendUrl: process.env.FRONTEND_URL as string,
};
