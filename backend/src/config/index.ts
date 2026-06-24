import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  port: number;
  mongodbUri: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  clientUrl: string;
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue?: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const num = parseInt(raw, 10);
  if (isNaN(num)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }
  return num;
}

const config: Config = {
  port: getEnvNumber('PORT', 5000),
  mongodbUri: getEnv('MONGODB_URI', 'mongodb://localhost:27017/soundryai'),
  jwtSecret: getEnv('JWT_SECRET', 'default-dev-secret-change-in-production'),
  jwtExpiresIn: getEnv('JWT_EXPIRES_IN', '3d'),
  smtpHost: getEnv('SMTP_HOST', 'localhost'),
  smtpPort: getEnvNumber('SMTP_PORT', 587),
  smtpUser: getEnv('SMTP_USER', ''),
  smtpPass: getEnv('SMTP_PASS', ''),
  smtpFrom: getEnv('SMTP_FROM', 'noreply@soundryai.com'),
  clientUrl: getEnv('CLIENT_URL', 'http://localhost:3000'),
};

export default config;