import { Router, Request, Response, RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

// CRITICAL GEO-PRIVACY: Response MUST use obfuscated_lat/obfuscated_lng, NEVER real lat/lng.
// The response type must not include lat/lng fields at all.

// 1. GET /providers - list providers. Sort by distance from user's lat/lng query params
router.get('/providers', (async (req: Request, res: Response) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : null;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : null;

    let query = `
      SELECT id, name, bio, obfuscated_lat as "obfuscatedLat", obfuscated_lng as "obfuscatedLng", services, hourly_rate as "hourlyRate", verified
      FROM care_providers
    `;
    let values: unknown[] = [];

    if (lat !== null && !isNaN(lat) && lng !== null && !isNaN(lng)) {
      query += `
        ORDER BY (
          6371 * acos(
            cos(radians($1)) * cos(radians(obfuscated_lat)) *
            cos(radians(obfuscated_lng) - radians($2)) +
            sin(radians($1)) * sin(radians(obfuscated_lat))
          )
        ) ASC
      `;
      values = [lat, lng];
    }

    const result = await pool.query(query, values);
    res.status(200).json(result.rows);
  } catch (err: unknown) {
    console.error('List providers error:', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}) as RequestHandler);

// 2. GET /providers/:id - get provider detail
router.get('/providers/:id', authenticateToken, (async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const providerResult = await pool.query(`
      SELECT id, user_id, name, bio, obfuscated_lat, obfuscated_lng, services, hourly_rate, verified
      FROM care_providers
      WHERE id = $1
    `, [id]);

    if (providerResult.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Provider not found.' });
      return;
    }

    const provider = providerResult.rows[0];
    
    // Check for confirmed booking
    const bookingResult = await pool.query(`
      SELECT 1 FROM care_bookings 
      WHERE provider_id = $1 AND user_id = $2 AND status = 'CONFIRMED'
    `, [id, userId]);

    const hasConfirmedBooking = bookingResult.rows.length > 0;

    let responseData: Record<string, unknown> = {
      id: provider.id,
      name: provider.name,
      bio: provider.bio,
      obfuscatedLat: provider.obfuscated_lat,
      obfuscatedLng: provider.obfuscated_lng,
      services: provider.services,
      hourlyRate: provider.hourly_rate,
      verified: provider.verified
    };

    if (hasConfirmedBooking || provider.user_id === userId || req.user?.role === 'ADMIN') {
      const realLocationResult = await pool.query('SELECT lat, lng FROM care_providers WHERE id = $1', [id]);
      // Only include real coords if explicitly allowed. 
      // Requirement says "Real address only if user has a CONFIRMED booking", here we map that to the real lat/lng.
      responseData.realLat = realLocationResult.rows[0].lat;
      responseData.realLng = realLocationResult.rows[0].lng;
    }

    res.status(200).json(responseData);
  } catch (err: unknown) {
    console.error('Get provider error:', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}) as RequestHandler);

const bookingSchema = z.object({
  providerId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  address: z.string().optional()
});

// 3. POST /bookings - create care booking (authenticated)
router.post('/bookings', authenticateToken, (async (req: Request, res: Response) => {
  try {
    const { providerId, startTime, endTime, address } = bookingSchema.parse(req.body);
    
    // verify provider exists
    const provider = await pool.query('SELECT id FROM care_providers WHERE id = $1', [providerId]);
    if (provider.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Provider not found.' });
      return;
    }

    const id = uuidv4();
    const result = await pool.query(`
      INSERT INTO care_bookings (id, provider_id, user_id, start_time, end_time, address, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'CONFIRMED')
      RETURNING id, provider_id as "providerId", user_id as "userId", start_time as "startTime", end_time as "endTime", status, address, created_at as "createdAt"
    `, [id, providerId, req.user!.userId, startTime, endTime, address || null]);

    res.status(201).json(result.rows[0]);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'BAD_REQUEST', details: err.errors });
      return;
    }
    console.error('Create care booking error:', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}) as RequestHandler);

// 4. GET /bookings - list user's care bookings
router.get('/bookings', authenticateToken, (async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        b.id, b.start_time, b.end_time, b.status, b.address, b.created_at,
        p.id as provider_id, p.name as provider_name, 
        p.obfuscated_lat as "obfuscatedLat", p.obfuscated_lng as "obfuscatedLng",
        p.lat as "realLat", p.lng as "realLng"
      FROM care_bookings b
      JOIN care_providers p ON b.provider_id = p.id
      WHERE b.user_id = $1
      ORDER BY b.start_time DESC
    `, [req.user!.userId]);

    interface CareBookingData {
      id: string;
      provider: {
        id: string;
        name: string;
        obfuscatedLat: number;
        obfuscatedLng: number;
        realLat?: number;
        realLng?: number;
      };
      startTime: string;
      endTime: string;
      status: string;
      address: string | null;
      createdAt: string;
    }

    const bookings = result.rows.map(row => {
      const data: CareBookingData = {
        id: row.id,
        provider: {
          id: row.provider_id,
          name: row.provider_name,
          obfuscatedLat: row.obfuscatedLat,
          obfuscatedLng: row.obfuscatedLng
        },
        startTime: row.start_time,
        endTime: row.end_time,
        status: row.status,
        address: row.address,
        createdAt: row.created_at
      };

      if (row.status === 'CONFIRMED') {
        data.provider.realLat = row.realLat;
        data.provider.realLng = row.realLng;
      }

      return data;
    });

    res.status(200).json(bookings);
  } catch (err: unknown) {
    console.error('List care bookings error:', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}) as RequestHandler);

// 5. PATCH /bookings/:id/confirm - confirm booking
router.patch('/bookings/:id/confirm', authenticateToken, requireRole('HOST', 'ADMIN'), (async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Need to verify if the current user is the provider or admin
    const bookingQuery = await pool.query(`
      SELECT b.id, p.user_id as provider_user_id 
      FROM care_bookings b
      JOIN care_providers p ON b.provider_id = p.id
      WHERE b.id = $1
    `, [id]);

    if (bookingQuery.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Booking not found.' });
      return;
    }

    const { provider_user_id } = bookingQuery.rows[0];

    if (userRole !== 'ADMIN' && provider_user_id !== userId) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'You are not the provider for this booking.' });
      return;
    }

    const result = await pool.query(`
      UPDATE care_bookings 
      SET status = 'CONFIRMED' 
      WHERE id = $1
      RETURNING id, provider_id as "providerId", user_id as "userId", start_time as "startTime", end_time as "endTime", status, address, created_at as "createdAt"
    `, [id]);

    res.status(200).json(result.rows[0]);
  } catch (err: unknown) {
    console.error('Confirm care booking error:', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}) as RequestHandler);

export default router;
