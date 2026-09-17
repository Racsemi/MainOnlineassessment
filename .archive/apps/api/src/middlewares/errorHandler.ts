import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('Unhandled Server Error:', {
    path: req.path,
    method: req.method,
    error: err.message || err,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.status || err.statusCode || 500;
  const message = statusCode === 500 && process.env.NODE_ENV === 'production'
    ? 'Internal Server Error'
    : err.message || 'An unexpected error occurred';

  res.status(statusCode).json({
    success: false,
    message,
    errors: err.errors || undefined
  });
}
