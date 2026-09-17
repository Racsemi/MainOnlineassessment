import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { prisma } from '@racsemi/database';
import { UserRole } from '@racsemi/shared';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
    organizationId: string;
  };
}

export interface CandidateRequest extends Request {
  candidateSession?: {
    id: string;
    invitationId: string;
    candidateId: string;
    assessmentId: string;
  };
}

export async function authenticateAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const decoded = jwt.verify(token, ENV.JWT_SECRET) as any;
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true, organizationId: true, isActive: true }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'User account not found or disabled' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      organizationId: user.organizationId
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid authentication session' });
  }
}

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (req.user.role === UserRole.SUPER_ADMIN) {
      return next(); // Super admin has full permissions
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access forbidden: Insufficient role permissions' });
    }

    next();
  };
}
