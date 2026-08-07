import jwt from 'jsonwebtoken';

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'GUEST' | 'HOST' | 'ADMIN';
}

export function generateAccessToken(payload: TokenPayload): string {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    throw new Error('ACCESS_TOKEN_SECRET environment variable is not defined');
  }

  return jwt.sign(payload, secret, { expiresIn: '15m' });
}

export function verifyAccessToken(token: string): TokenPayload {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    throw new Error('ACCESS_TOKEN_SECRET environment variable is not defined');
  }

  const decoded = jwt.verify(token, secret);
  return decoded as TokenPayload;
}
