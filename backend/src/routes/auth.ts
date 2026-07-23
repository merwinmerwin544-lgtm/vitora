import { Router, Response } from 'express';
import { prisma } from '../utils/db';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Synchronize Firebase user session with local Prisma SQLite database
router.post('/sync', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'User context synchronization failed' });
  }

  try {
    // Log user sync in audit trails
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_SESSION_SYNCED',
        ipAddress: req.ip,
      },
    });

    return res.json({ user });
  } catch (error) {
    console.error('Session sync error:', error);
    return res.status(500).json({ error: 'Internal server error during session synchronization' });
  }
});

// Retrieve current authenticated clinician profile
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  return res.json({ user: req.user });
});

export default router;
