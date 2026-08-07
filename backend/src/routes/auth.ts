import { Router, Request, Response, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { generateAccessToken, TokenPayload } from '../utils/tokens.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().optional(),
  role: z.enum(['GUEST', 'HOST', 'ADMIN']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string().uuid(),
});

// Calculate expiry for refresh token (7 days)
const getRefreshTokenExpiry = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
};

// Generate and store refresh token
async function issueRefreshToken(userId: string): Promise<string> {
  const tokenId = uuidv4();
  // We use token id as the token itself since it's unguessable uuidv4
  const expiresAt = getRefreshTokenExpiry();

  // Hash the token id before storing it
  const tokenHash = await bcrypt.hash(tokenId, 10);

  await pool.query(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
    [tokenId, userId, tokenHash, expiresAt]
  );

  return tokenId; // The plain UUID is returned to the user
}

router.post('/register', (async (req: Request, res: Response) => {
  try {
    const { email, password, displayName, role } = registerSchema.parse(req.body);
    
    // Check if user exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'CONFLICT', message: 'Email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userRole = role || 'GUEST';

    const result = await pool.query(
      'INSERT INTO users (email, password_hash, display_name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, role, display_name',
      [email, passwordHash, displayName || null, userRole]
    );

    const user = result.rows[0];
    const payload: TokenPayload = { userId: user.id, email: user.email, role: user.role };
    
    const accessToken = generateAccessToken(payload);
    const refreshToken = await issueRefreshToken(user.id);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role
      },
      accessToken,
      refreshToken
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'BAD_REQUEST', details: err.errors });
      return;
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}) as RequestHandler);

router.post('/login', (async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const result = await pool.query('SELECT id, email, password_hash, role, display_name FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid credentials.' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid credentials.' });
      return;
    }

    const payload: TokenPayload = { userId: user.id, email: user.email, role: user.role };
    
    const accessToken = generateAccessToken(payload);
    const refreshToken = await issueRefreshToken(user.id);

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role
      },
      accessToken,
      refreshToken
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'BAD_REQUEST', details: err.errors });
      return;
    }
    console.error('Login error:', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}) as RequestHandler);

router.post('/refresh', (async (req: Request, res: Response) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    const result = await pool.query(
      'SELECT id, user_id, token_hash, expires_at, revoked FROM refresh_tokens WHERE id = $1',
      [refreshToken]
    );
    const tokenRecord = result.rows[0];

    if (!tokenRecord || tokenRecord.revoked || new Date() > new Date(tokenRecord.expires_at)) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired refresh token.' });
      return;
    }

    // Revoke old token
    await pool.query('UPDATE refresh_tokens SET revoked = true WHERE id = $1', [refreshToken]);

    // Issue new pairs
    const userResult = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [tokenRecord.user_id]);
    const user = userResult.rows[0];
    
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'User no longer exists.' });
      return;
    }

    const payload: TokenPayload = { userId: user.id, email: user.email, role: user.role };
    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = await issueRefreshToken(user.id);

    res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'BAD_REQUEST', details: err.errors });
      return;
    }
    console.error('Refresh error:', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}) as RequestHandler);

router.post('/logout', authenticateToken, (async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
       await pool.query('UPDATE refresh_tokens SET revoked = true WHERE id = $1 AND user_id = $2', [refreshToken, req.user?.userId]);
    }
    res.status(200).json({ message: 'Logged out successfully.' });
  } catch (err: unknown) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}) as RequestHandler);

router.get('/me', authenticateToken, (async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const result = await pool.query(
      'SELECT id, email, display_name, role, created_at FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
      return;
    }

    res.status(200).json({ user: result.rows[0] });
  } catch (err: unknown) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}) as RequestHandler);

export default router;
