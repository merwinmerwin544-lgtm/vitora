import { Request, Response, NextFunction } from 'express';
import { verifyFirebaseIdToken } from '../utils/firebase';
import { prisma } from '../utils/db';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    name: string;
    role: string;
    firebaseUid: string;
  };
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header is missing' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Bearer token is missing' });
  }

  try {
    const decodedFirebase = await verifyFirebaseIdToken(token);
    
    // Look up user in SQLite database
    let user = await prisma.user.findUnique({
      where: { firebaseUid: decodedFirebase.uid }
    });

    // Link by email if user logged in via email previously but now logged in via Google OAuth
    if (!user) {
      user = await prisma.user.findUnique({
        where: { email: decodedFirebase.email }
      });
      
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { 
            firebaseUid: decodedFirebase.uid,
            provider: decodedFirebase.provider,
            profilePhoto: decodedFirebase.picture || user.profilePhoto,
            lastLogin: new Date()
          }
        });
      }
    }

    // Auto-create user inline if they exist in Firebase but have no local Prisma profile yet
    if (!user) {
      user = await prisma.user.create({
        data: {
          firebaseUid: decodedFirebase.uid,
          email: decodedFirebase.email,
          name: decodedFirebase.name || decodedFirebase.email.split('@')[0],
          provider: decodedFirebase.provider,
          profilePhoto: decodedFirebase.picture || null,
          role: 'HEALTH_WORKER',
          lastLogin: new Date()
        }
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      firebaseUid: decodedFirebase.uid
    };
    next();
  } catch (error: any) {
    console.error('Auth verification error:', error.message);
    return res.status(403).json({ error: 'Invalid, expired, or unverified authorization token' });
  }
}
