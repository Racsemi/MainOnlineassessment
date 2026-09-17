import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../utils/db';

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    // Seed initial admin if none exists
    const adminCount = await prisma.user.count();
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@racsemi.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
    
    if (adminCount === 0 && email === adminEmail && password === adminPassword) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          name: 'System Admin',
          role: 'ADMIN'
        }
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role }, 
      process.env.JWT_SECRET!,
      { expiresIn: '1d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const logout = (req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  res.json({ message: 'Logged out successfully' });
};

export const me = (req: any, res: Response) => {
  res.json({ user: req.user });
};
