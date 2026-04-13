import Redis from 'ioredis';
import logger from '../utils/logger';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  retryStrategy(times: number): number | null {
    if (times > 10) {
      logger.error('Redis: max reconnection attempts reached, giving up');
      return null; // stop retrying
    }
    const delay = Math.min(times * 100, 3000);
    logger.warn(`Redis: reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
  reconnectOnError(err: Error): boolean | 1 | 2 {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return 2; // reconnect and resend
    }
    return false;
  },
};

const redis = new Redis(redisConfig);

redis.on('connect', () => {
  logger.info('Redis: connected');
});

redis.on('ready', () => {
  logger.info('Redis: ready');
});

redis.on('error', (err: Error) => {
  logger.error('Redis error', { message: err.message, stack: err.stack });
});

redis.on('close', () => {
  logger.warn('Redis: connection closed');
});

redis.on('reconnecting', () => {
  logger.info('Redis: reconnecting...');
});

redis.on('end', () => {
  logger.warn('Redis: connection ended');
});

export default redis;
