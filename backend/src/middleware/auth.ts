import { RequestHandler } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/tokens.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export const authenticateToken: RequestHandler = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Access token is missing.' });
    return;
  }

  try {
    const user = verifyAccessToken(token);
    req.user = user;
    next();
  } catch (error: unknown) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Invalid or expired access token.' });
    return;
  }
};

export const requireRole = (...roles: Array<'GUEST' | 'HOST' | 'ADMIN'>): RequestHandler => {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Not authenticated.' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions.' });
      return;
    }

    next();
  };
};
