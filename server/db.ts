import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway')
    ? { rejectUnauthorized: false }
    : false,
});

export default pool;

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS machines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS personnel (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skills (
      personnel_id TEXT NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
      machine_id TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
      level TEXT NOT NULL DEFAULT 'none' CHECK (level IN ('expert','competent','learning','none')),
      PRIMARY KEY (personnel_id, machine_id)
    );

    CREATE TABLE IF NOT EXISTS schedule (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      machine_id TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
      operator_id TEXT REFERENCES personnel(id) ON DELETE SET NULL,
      collaborator_id TEXT REFERENCES personnel(id) ON DELETE SET NULL,
      production_items TEXT NOT NULL DEFAULT '',
      assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
      UNIQUE (date, machine_id)
    );

    CREATE TABLE IF NOT EXISTS leave_records (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      personnel_id TEXT NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
      UNIQUE (date, personnel_id)
    );
  `);
  console.log('Database tables initialized');
}
