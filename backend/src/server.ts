import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import screeningRoutes from './routes/screening';
import reportsRoutes from './routes/reports';
import { prisma } from './utils/db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;

// Config CORS
app.use(cors({
  origin: '*', // Allow all origins for dev/testing, customize for prod
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routing API endpoints
app.use('/api/auth', authRoutes);
app.use('/api/screening', screeningRoutes);
app.use('/api/reports', reportsRoutes);

// Health check API
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    // Check DB connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'OK',
      message: 'Vitora Express server is active',
      database: 'Connected'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Vitora Express server is active',
      database: 'Disconnected',
      error: String(error)
    });
  }
});

// 404 Route handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Exception error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Server Exception:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error occurred in Vitora Backend'
  });
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`⚡️ Vitora Express Server listening on port ${PORT}`);
  console.log(`🚀 API active: http://localhost:${PORT}`);
  console.log(`==================================================`);
});
