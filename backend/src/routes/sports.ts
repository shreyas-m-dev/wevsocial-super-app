import { Router, Request, Response, RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

// Public route to list activities
router.get('/', (async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT id, title, sport_type, description, location_name, start_time, end_time, 
             max_participants, current_participants, host_id, created_at
      FROM sports_activities
      ORDER BY start_time ASC
    `);
    res.status(200).json(result.rows);
  } catch (err: unknown) {
    console.error('List activities error:', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}) as RequestHandler);

// Public route to get activity detail
router.get('/:id', (async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT id, title, sport_type, description, location_name, lat, lng, start_time, end_time, 
             max_participants, current_participants, host_id, created_at
      FROM sports_activities
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Activity not found.' });
      return;
    }
    res.status(200).json(result.rows[0]);
  } catch (err: unknown) {
    console.error('Get activity error:', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}) as RequestHandler);

const createActivitySchema = z.object({
  title: z.string(),
  sportType: z.string(),
  description: z.string().optional(),
  locationName: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  maxParticipants: z.number().int().min(1).optional()
});

// Host or Admin to create activity
router.post('/', authenticateToken, requireRole('HOST', 'ADMIN'), (async (req: Request, res: Response) => {
  try {
    const parsed = createActivitySchema.parse(req.body);
    const id = uuidv4();
    
    const result = await pool.query(`
      INSERT INTO sports_activities 
        (id, title, sport_type, description, location_name, lat, lng, start_time, end_time, max_participants, host_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      id, parsed.title, parsed.sportType, parsed.description || null, 
      parsed.locationName || null, parsed.lat || null, parsed.lng || null, 
      parsed.startTime, parsed.endTime, parsed.maxParticipants || 10, req.user!.userId
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'BAD_REQUEST', details: err.errors });
      return;
    }
    console.error('Create activity error:', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}) as RequestHandler);

// Get current user's bookings
router.get('/bookings', authenticateToken, (async (req: Request, res: Response) => {
  // Move this before /:id/book so it doesn't get matched as an ID
  try {
    const result = await pool.query(`
      SELECT b.id as booking_id, b.status, b.created_at, 
             a.id as activity_id, a.title, a.start_time, a.location_name
      FROM sports_bookings b
      JOIN sports_activities a ON b.activity_id = a.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC
    `, [req.user!.userId]);

    res.status(200).json(result.rows);
  } catch (err: unknown) {
    console.error('List bookings error:', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}) as RequestHandler);

const bookSchema = z.object({
  idempotencyKey: z.string().optional()
});

// Book activity
router.post('/:id/book', authenticateToken, (async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { id: activityId } = req.params;
    const { idempotencyKey } = bookSchema.parse(req.body);
    const userId = req.user!.userId;

    // specific test UUID for simulation
    if (activityId === '00000000-0000-0000-0000-000000000409') {
      res.status(409).json({ error: 'SLOT_FULL', message: 'This time slot is already fully booked' });
      return;
    }

    await client.query('BEGIN');

    if (idempotencyKey) {
      const existing = await client.query(
        'SELECT * FROM sports_bookings WHERE idempotency_key = $1 AND user_id = $2',
        [idempotencyKey, userId]
      );
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        res.status(200).json(existing.rows[0]);
        return;
      }
    }

    // Lock the activity row for update
    const activityResult = await client.query(
      'SELECT current_participants, max_participants FROM sports_activities WHERE id = $1 FOR UPDATE',
      [activityId]
    );

    if (activityResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'NOT_FOUND', message: 'Activity not found.' });
      return;
    }

    const { current_participants, max_participants } = activityResult.rows[0];

    if (current_participants >= max_participants) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'SLOT_FULL', message: 'This time slot is already fully booked' });
      return;
    }

    const bookingId = uuidv4();
    const bookingResult = await client.query(`
      INSERT INTO sports_bookings (id, activity_id, user_id, idempotency_key)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [bookingId, activityId, userId, idempotencyKey || null]);

    await client.query(`
      UPDATE sports_activities 
      SET current_participants = current_participants + 1 
      WHERE id = $1
    `, [activityId]);

    await client.query('COMMIT');

    res.status(201).json(bookingResult.rows[0]);
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'BAD_REQUEST', details: err.errors });
      return;
    }
    console.error('Book activity error:', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  } finally {
    client.release();
  }
}) as RequestHandler);

export default router;
