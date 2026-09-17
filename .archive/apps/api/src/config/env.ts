import * as dotenv from 'dotenv';
import * as path from 'path';

// Load root or local .env
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/racsemi_assess?schema=public',
  JWT_SECRET: process.env.JWT_SECRET || 'racsemi_super_secret_jwt_access_key_minimum_32_chars_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'racsemi_super_secret_jwt_refresh_key_minimum_32_chars_2026',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  COOKIE_SECRET: process.env.COOKIE_SECRET || 'racsemi_secure_cookie_secret_key_prod_grade_2026',
  APP_URL: process.env.APP_URL || 'http://localhost:3000',
  API_URL: process.env.API_URL || 'http://localhost:4000',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  EMAIL_FROM: process.env.EMAIL_FROM || 'RACSEMI Recruitment <no-reply@racsemi.com>',
  EMAIL_MOCK: process.env.EMAIL_MOCK === 'true' || true,
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379'
};
