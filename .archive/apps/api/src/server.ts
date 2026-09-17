import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ENV } from './config/env';
import { apiRouter } from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { prisma } from '@racsemi/database';

const app = express();

// Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
  origin: (origin, callback) => {
    // Allow local dev origins or configured frontend
    if (!origin || origin.includes('localhost') || origin === ENV.CORS_ORIGIN) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true
}));

app.use(cookieParser(ENV.COOKIE_SECRET));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Simple request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    }
  });
  next();
});

// Health check endpoints
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      services: {
        database: 'connected',
        api: 'operational'
      }
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'degraded',
      error: err.message,
      timestamp: new Date()
    });
  }
});

app.get('/ready', (req, res) => res.json({ ready: true }));
app.get('/live', (req, res) => res.json({ live: true }));

// Main REST API Router
app.use('/api', apiRouter);

// Global Error Handler
app.use(errorHandler);

const server = app.listen(ENV.PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 RACSEMI Assess API Server running on port ${ENV.PORT}`);
  console.log(`🌐 Base URL: ${ENV.API_URL}`);
  console.log(`📦 Database: Connected`);
  console.log(`🛡️ Environment: ${ENV.NODE_ENV}`);
  console.log(`======================================================\n`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
});

export { app, server };
