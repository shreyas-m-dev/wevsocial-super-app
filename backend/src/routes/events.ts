import { Router, Request, Response, RequestHandler } from 'express';
import { pool } from '../db/pool.js';

const router = Router();

// Public route to list events
router.get('/', (async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT id, title, description, location_name, start_time, host_id, created_at
      FROM events
      ORDER BY start_time ASC
    `);
    res.status(200).json(result.rows);
  } catch (err: unknown) {
    console.error('List events error:', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}) as RequestHandler);

// Public route to get event detail
router.get('/:id', (async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT id, title, description, location_name, start_time, host_id, created_at
      FROM events
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Event not found.' });
      return;
    }
    res.status(200).json(result.rows[0]);
  } catch (err: unknown) {
    console.error('Get event error:', err);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
}) as RequestHandler);

export default router;
