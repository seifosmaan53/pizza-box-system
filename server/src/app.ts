import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler';
import logger from './utils/logger';
import { apiRateLimiter } from './middleware/rateLimiter';
import { sanitizeInput } from './middleware/sanitize';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import storeRoutes from './routes/stores';
import boxTypeRoutes from './routes/boxTypes';
import boxSizeRoutes from './routes/boxSizes';
import inventoryRoutes from './routes/inventory';
import invoiceRoutes from './routes/invoices';
import analyticsRoutes from './routes/analytics';
import auditRoutes from './routes/audit';
import aiRoutes from './routes/ai';
import settingsRoutes from './routes/settings';
import productsRouter from './routes/products';

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,   // Allow cross-origin resources (fonts, images)
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(compression());
app.use(sanitizeInput);
app.use(morgan('combined', {
  stream: { write: (message) => logger.http(message.trim()) },
}));

app.get('/health', async (_req, res) => {
  const checks: Record<string, string> = {};
  let healthy = true;

  // Database check
  try {
    const prisma = (await import('./lib/prisma')).default;
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
    healthy = false;
  }

  // Redis check
  try {
    const redis = (await import('./lib/redis')).default;
    await redis.ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'error';
    healthy = false;
  }

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  });
});

// API Documentation (available at /api-docs)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Pizza Box API Docs',
}));

app.use('/api', apiRateLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/box-types', boxTypeRoutes);
app.use('/api/box-sizes', boxSizeRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/audit-log', auditRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/products', productsRouter);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

app.use(errorHandler);

export default app;
