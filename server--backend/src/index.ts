import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import router from './routes';
import { apiRateLimiter } from './middleware/rateLimiter';
import { env } from './config/env';

const app = express();
const httpServer = createServer(app);

const allowedOrigins = env.corsOrigins;

// Socket.IO setup
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  // Clients join a user-specific room on auth
  socket.on('join', (userId: string) => {
    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`[WS] ${socket.id} joined room user:${userId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

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
  res.json({ status: 'ok', message: 'CampusAI Backend is running!', websocket: true });
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
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
});