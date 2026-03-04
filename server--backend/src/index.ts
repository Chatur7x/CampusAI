import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import router from './routes';
import { apiRateLimiter } from './middleware/rateLimiter';
import { env } from './config/env';

const app = express();

const allowedOrigins = env.corsOrigins;

app.set('trust proxy', 1); // honor X-Forwarded-For when behind proxies

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));

// Health check route
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'CampusAI Backend is running!' });
});

// Mount API routes
app.use('/api', apiRateLimiter, router);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// Global error handler
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});