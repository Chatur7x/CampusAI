import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Important: This allows your React app (5173) to talk to this Server (5000)
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

// Health check route
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'CampusAI Backend is running!' });
});

// Mock Auth Route (Prevents Frontend from hanging on a blank screen)
app.get('/api/auth/me', (req: Request, res: Response) => {
  res.json({ user: null, isAuthenticated: false }); 
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📡 API health check: http://localhost:${PORT}/api/health`);
});