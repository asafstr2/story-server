import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import os from 'os';

const router = Router();

/**
 * @route GET /health
 * @desc Health check endpoint
 * @access Public
 */
router.get('/', (req: Request, res: Response) => {
  // Database health status
  const databaseStatus = {
    status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    state: mongoose.connection.readyState
  };

  // System health
  const systemStatus = {
    uptime: process.uptime(),
    processMemoryUsage: process.memoryUsage(),
    freeMemory: os.freemem(),
    totalMemory: os.totalmem(),
    cpus: os.cpus().length
  };

  const healthData = {
    status: 'OK',
    timestamp: Date.now(),
    env: process.env.NODE_ENV || 'development',
    database: databaseStatus,
    system: systemStatus
  };

  // Return a 503 status if the database connection is down
  const statusCode = mongoose.connection.readyState === 1 ? 200 : 503;

  res.status(statusCode).json(healthData);
});

export default router; 