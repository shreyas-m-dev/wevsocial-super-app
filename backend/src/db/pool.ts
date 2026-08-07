import { Pool, PoolConfig } from 'pg';

const config: PoolConfig = {
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

if (process.env.DATABASE_URL) {
  config.connectionString = process.env.DATABASE_URL;
} else {
  config.host = process.env.DB_HOST || 'localhost';
  config.port = parseInt(process.env.DB_PORT || '5432', 10);
  config.database = process.env.DB_NAME || 'wevsocial';
  config.user = process.env.DB_USER || 'wevsocial';
  config.password = process.env.DB_PASSWORD || 'wevsocial_dev_password';
}

export const pool = new Pool(config);

pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});
