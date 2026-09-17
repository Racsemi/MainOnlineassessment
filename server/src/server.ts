import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import prisma from './utils/db';

import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

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

app.use('/api/auth', authRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/settings', settingsRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
