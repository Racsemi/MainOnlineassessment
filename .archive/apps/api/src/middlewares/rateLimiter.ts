import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

export const candidateApiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  message: { success: false, message: 'Rate limit exceeded. Please slow down.' }
});

export const codeRunLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 15, // 15 code executions per minute per IP
  message: { success: false, message: 'Code execution rate limit reached. Please wait before running again.' }
});
