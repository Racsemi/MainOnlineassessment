import { Request, Response } from 'express';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { prisma } from '@racsemi/database';
import { ENV } from '../config/env';
import { AuthenticatedRequest } from '../middlewares/auth';
import { logAuditAction } from '../services/auditService';
import { z } from 'zod';
import IORedisMock from 'ioredis-mock';
import IORedis from 'ioredis';

const redis = process.env.NO_INFRA === 'true' 
  ? new IORedisMock() 
  : new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: null });

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export async function login(req: Request, res: Response) {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, message: 'Invalid email or password format' });
    }

    const { email, password } = parseResult.data;
    const emailKey = email.toLowerCase().trim();

    // Check Lockout
    const attempts = await redis.get(`login_attempts:${emailKey}`);
    if (attempts && parseInt(attempts, 10) >= 5) {
      return res.status(429).json({ success: false, message: 'Too many failed login attempts. Account locked for 15 minutes.' });
    }

    const user = await prisma.user.findUnique({
      where: { email: emailKey },
      include: { organization: true }
    });

    if (!user || !user.isActive) {
      await redis.incr(`login_attempts:${emailKey}`);
      await redis.expire(`login_attempts:${emailKey}`, 900); // 15 mins
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      await redis.incr(`login_attempts:${emailKey}`);
      await redis.expire(`login_attempts:${emailKey}`, 900);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Success, reset attempts
    await redis.del(`login_attempts:${emailKey}`);

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId
    };

    const token = jwt.sign(tokenPayload, ENV.JWT_SECRET, { expiresIn: '8h' });
    const refreshToken = jwt.sign({ userId: user.id }, ENV.JWT_REFRESH_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: ENV.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000
    });

    await logAuditAction({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug
        }
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Login failed' });
  }
}

export async function getCurrentUser(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { organization: true }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug
        }
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function logout(req: AuthenticatedRequest, res: Response) {
  res.clearCookie('token');
  if (req.user) {
    await logAuditAction({
      organizationId: req.user.organizationId,
      userId: req.user.id,
      action: 'USER_LOGOUT',
      entityType: 'User',
      entityId: req.user.id
    });
  }
  return res.json({ success: true, message: 'Logged out successfully' });
}
