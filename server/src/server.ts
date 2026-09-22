import express, { Request, Response } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import prisma from './utils/db';
import { registerInterviewSocket } from './socket/interviewSocket';

import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 5000;

// --- CORS ---
// Origins are driven by the ALLOWED_ORIGINS env var (comma-separated, no trailing
// slash), so new front-ends can be added in Render without a code change.
// CLIENT_URL is kept in the list for backwards compatibility: it is still used
// elsewhere to build candidate assessment links.
const allowedOrigins = [
  ...(process.env.ALLOWED_ORIGINS || '').split(','),
  process.env.CLIENT_URL || '',
]
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

// NOTE: we do NOT reflect arbitrary origins. Auth uses a `token` cookie with
// sameSite:'none' + secure:true, so reflecting any origin alongside
// credentials:true would let any website make authenticated requests.
const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    // Same-origin / server-to-server requests (curl, health checks) send no Origin.
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin.replace(/\/$/, ''))) {
      return callback(null, true);
    }

    console.warn(`[CORS] Blocked origin: ${origin}`);
    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
// Answer preflight for every route before anything else can reject it.
app.options('*', cors(corsOptions));

if (allowedOrigins.length === 0) {
  console.warn('[CORS] No ALLOWED_ORIGINS or CLIENT_URL set — all browser origins will be blocked.');
} else {
  console.log(`[CORS] Allowed origins: ${allowedOrigins.join(', ')}`);
}
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// --- Socket.IO Real-Time Server ---
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin.replace(/\/$/, ''))) {
        return callback(null, true);
      }
      return callback(null, true); // Allow client connection for interviews
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 30000,
  pingInterval: 25000,
});

registerInterviewSocket(io);

// Basic health check
app.get('/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', db: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

import authRoutes from './routes/auth.routes';
import assessmentRoutes from './routes/assessment.routes';
import questionRoutes from './routes/question.routes';
import candidateRoutes from './routes/candidate.routes';
import sessionRoutes from './routes/session.routes';
import settingsRoutes from './routes/settings.routes';
import interviewRoutes from './routes/interview.routes';

app.use('/api/auth', authRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/interviews', interviewRoutes);

httpServer.listen(PORT, () => {
  console.log(`Server and WebSocket running on port ${PORT}`);
});

