import logger from './logger';

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'REDIS_HOST',
] as const;

export function checkRequiredEnvVars(): void {
  const missing: string[] = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    const message = [
      '',
      '========================================',
      'FATAL: Missing required environment variables:',
      '',
      ...missing.map((v) => `  - ${v}`),
      '',
      'Please set these variables in your .env file or environment.',
      '========================================',
      '',
    ].join('\n');

    logger.error('Missing required environment variables', { missing });
    console.error(message);
    process.exit(1);
  }

  logger.info('All required environment variables are present');
}
