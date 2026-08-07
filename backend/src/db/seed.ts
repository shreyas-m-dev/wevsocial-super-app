import { pool } from './pool.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { obfuscateLocation } from '../utils/geo.js';

async function seed() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Seeding database...');
    
    // Clear existing data (in reverse dependency order to avoid FK issues, or just cascade if needed but let's just clear for safety)
    await client.query('DELETE FROM care_bookings');
    await client.query('DELETE FROM care_providers');
    await client.query('DELETE FROM sports_bookings');
    await client.query('DELETE FROM sports_activities');
    await client.query('DELETE FROM events');
    await client.query('DELETE FROM refresh_tokens');
    await client.query('DELETE FROM users');
    
    // 1. Users
    const passwordHash = await bcrypt.hash('password123', 10);
    
    const aliceId = uuidv4();
    const bobId = uuidv4();
    const adminId = uuidv4();

    await client.query(`
      INSERT INTO users (id, email, password_hash, display_name, role) VALUES 
      ($1, 'alice@test.com', $2, 'Alice (Host)', 'HOST'),
      ($3, 'bob@test.com', $2, 'Bob (Guest)', 'GUEST'),
      ($4, 'admin@test.com', $2, 'Admin User', 'ADMIN')
    `, [aliceId, passwordHash, bobId, adminId]);
    console.log('Users seeded');

    // 2. Sports Activities
    const sports = [
      { id: uuidv4(), title: 'Morning Yoga in the Park', type: 'YOGA', lat: 40.7829, lng: -73.9654 },
      { id: uuidv4(), title: '5v5 Basketball Pickup', type: 'BASKETBALL', lat: 40.7589, lng: -73.9851 },
      { id: uuidv4(), title: 'Beginner Tennis Clinic', type: 'TENNIS', lat: 40.7306, lng: -73.9352 },
      { id: uuidv4(), title: 'Central Park 10K Run', type: 'RUNNING', lat: 40.7812, lng: -73.9665 },
      { id: '00000000-0000-0000-0000-000000000409', title: 'Test Double Booking Activity', type: 'TEST', lat: 40.7500, lng: -73.9900 },
    ];
    
    for (const s of sports) {
      await client.query(`
        INSERT INTO sports_activities (id, title, sport_type, description, location_name, lat, lng, start_time, end_time, max_participants, host_id)
        VALUES ($1, $2, $3, 'A great activity for everyone.', 'NYC Park', $4, $5, NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 2 hours', 10, $6)
      `, [s.id, s.title, s.type, s.lat, s.lng, aliceId]);
    }
    console.log('Sports activities seeded');

    // 3. Care Providers
    const providers = [
      { id: uuidv4(), name: 'Dr. Sarah Jenkins', bio: 'Experienced physical therapist.', lat: 40.7128, lng: -74.0060, rate: 85.00 },
      { id: uuidv4(), name: 'Mike\'s Massage Therapy', bio: 'Specializing in sports recovery.', lat: 40.7580, lng: -73.9855, rate: 100.00 },
      { id: uuidv4(), name: 'Wellness Center NYC', bio: 'Acupuncture and holistic care.', lat: 40.7831, lng: -73.9712, rate: 120.00 }
    ];

    for (const p of providers) {
      const { obfuscatedLat, obfuscatedLng, h3Index } = obfuscateLocation(p.lat, p.lng);
      await client.query(`
        INSERT INTO care_providers (id, user_id, name, bio, lat, lng, obfuscated_lat, obfuscated_lng, h3_index, hourly_rate, verified)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
      `, [p.id, aliceId, p.name, p.bio, p.lat, p.lng, obfuscatedLat, obfuscatedLng, h3Index, p.rate]);
    }
    console.log('Care providers seeded');

    // 4. Events Stubs
    await client.query(`
      INSERT INTO events (id, title, description, location_name, start_time, host_id) VALUES
      ($1, 'NYC Marathon 2026', 'Annual marathon event.', 'Staten Island', NOW() + INTERVAL '30 days', $2),
      ($3, 'Summer Sports Fest', 'Various outdoor sports.', 'Central Park', NOW() + INTERVAL '15 days', $2)
    `, [uuidv4(), adminId, uuidv4()]);
    console.log('Events seeded');

    await client.query('COMMIT');
    console.log('Seeding complete!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
  } finally {
    client.release();
  }
}

// If run directly
if (require.main === module || process.argv[1].endsWith('seed.ts') || process.argv[1].endsWith('seed.js')) {
  seed().then(() => pool.end());
}
