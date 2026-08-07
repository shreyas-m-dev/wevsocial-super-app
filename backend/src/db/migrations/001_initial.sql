-- users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100),
  role VARCHAR(20) DEFAULT 'GUEST' CHECK (role IN ('GUEST','HOST','ADMIN')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- sports_activities table
CREATE TABLE IF NOT EXISTS sports_activities (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  sport_type VARCHAR(50) NOT NULL,
  description TEXT,
  location_name VARCHAR(255),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  max_participants INT DEFAULT 10,
  current_participants INT DEFAULT 0,
  host_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sports_activities_host_id ON sports_activities(host_id);
CREATE INDEX IF NOT EXISTS idx_sports_activities_start_time ON sports_activities(start_time);

-- sports_bookings table
CREATE TABLE IF NOT EXISTS sports_bookings (
  id UUID PRIMARY KEY,
  activity_id UUID REFERENCES sports_activities(id),
  user_id UUID REFERENCES users(id),
  status VARCHAR(30) DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED','PENDING_SYNC','CANCELLED','CONFLICT_REJECTED')),
  idempotency_key VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sports_bookings_activity_id ON sports_bookings(activity_id);
CREATE INDEX IF NOT EXISTS idx_sports_bookings_user_id ON sports_bookings(user_id);

-- care_providers table
CREATE TABLE IF NOT EXISTS care_providers (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  bio TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  obfuscated_lat DOUBLE PRECISION NOT NULL,
  obfuscated_lng DOUBLE PRECISION NOT NULL,
  h3_index VARCHAR(20) NOT NULL,
  services TEXT[] DEFAULT '{}',
  hourly_rate DECIMAL(10,2),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_care_providers_user_id ON care_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_care_providers_h3_index ON care_providers(h3_index);

-- care_bookings table
CREATE TABLE IF NOT EXISTS care_bookings (
  id UUID PRIMARY KEY,
  provider_id UUID REFERENCES care_providers(id),
  user_id UUID REFERENCES users(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','CANCELLED','CONFLICT_REJECTED')),
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_care_bookings_provider_id ON care_bookings(provider_id);
CREATE INDEX IF NOT EXISTS idx_care_bookings_user_id ON care_bookings(user_id);

-- events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location_name VARCHAR(255),
  start_time TIMESTAMPTZ,
  host_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_host_id ON events(host_id);
