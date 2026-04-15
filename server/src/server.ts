import dotenv from 'dotenv';
dotenv.config();

import { checkRequiredEnvVars } from './utils/envCheck';
checkRequiredEnvVars();

import app from './app';
import prisma from './lib/prisma';
import redis from './lib/redis';
import logger from './utils/logger';
import { startCronJobs } from './jobs';

const PORT = parseInt(process.env.PORT || '3001', 10);
const SHUTDOWN_TIMEOUT = parseInt(process.env.SHUTDOWN_TIMEOUT || '10000', 10);

async function main(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected');

    await redis.ping();
    logger.info('Redis connected');

    startCronJobs();

    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received — shutting down gracefully...`);

      // Stop accepting new connections
      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await prisma.$disconnect();
          logger.info('Database disconnected');
        } catch (err) {
          logger.error('Error disconnecting database:', err);
        }

        try {
          await redis.quit();
          logger.info('Redis disconnected');
        } catch (err) {
          logger.error('Error disconnecting Redis:', err);
        }

        logger.info('Shutdown complete');
        process.exit(0);
      });

      // Force exit if graceful shutdown takes too long
      setTimeout(() => {
        logger.error(`Forced shutdown after ${SHUTDOWN_TIMEOUT}ms timeout`);
        process.exit(1);
      }, SHUTDOWN_TIMEOUT).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Catch unhandled errors that would otherwise crash the process silently
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
  process.exit(1);
});

main();
