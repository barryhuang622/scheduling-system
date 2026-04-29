import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
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
      collaborator_ids TEXT NOT NULL DEFAULT '',
      production_items TEXT NOT NULL DEFAULT '',
      assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
      UNIQUE (date, machine_id)
    );

    CREATE TABLE IF NOT EXISTS overtime_schedule (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      machine_id TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
      operator_id TEXT REFERENCES personnel(id) ON DELETE SET NULL,
      collaborator_ids TEXT NOT NULL DEFAULT '',
      production_items TEXT NOT NULL DEFAULT '',
      UNIQUE (date, machine_id)
    );

    CREATE TABLE IF NOT EXISTS leave_records (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      personnel_id TEXT NOT NULL REFERENCES personnel(id) ON DELETE CASCADE,
      UNIQUE (date, personnel_id)
    );
  `);

  // Migration: rename collaborator_id → collaborator_ids (comma-separated)
  await pool.query(`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='schedule' AND column_name='collaborator_id') THEN
        ALTER TABLE schedule DROP CONSTRAINT IF EXISTS schedule_collaborator_id_fkey;
        ALTER TABLE schedule RENAME COLUMN collaborator_id TO collaborator_ids;
        ALTER TABLE schedule ALTER COLUMN collaborator_ids SET DEFAULT '';
        UPDATE schedule SET collaborator_ids = '' WHERE collaborator_ids IS NULL;
        ALTER TABLE schedule ALTER COLUMN collaborator_ids SET NOT NULL;
      END IF;
    END $$;
  `);

  // Backfill: 重算 assigned_date 為「同機台同操作員連續排班的最早日期」。
  // 技巧：在依 date 排序的相同 (machine, operator) 序列裡，date - row_number()
  // 對於連續日期會是常數，可以用來把連續區段分組，再取每組的 MIN(date)。
  await pool.query(`
    WITH ranked AS (
      SELECT id, date, machine_id, operator_id,
        date - (ROW_NUMBER() OVER (PARTITION BY machine_id, operator_id ORDER BY date))::int AS grp
      FROM schedule
      WHERE operator_id IS NOT NULL
    ),
    grouped AS (
      SELECT id,
        MIN(date) OVER (PARTITION BY machine_id, operator_id, grp) AS tenure_start
      FROM ranked
    )
    UPDATE schedule s
    SET assigned_date = g.tenure_start
    FROM grouped g
    WHERE s.id = g.id
      AND s.assigned_date IS DISTINCT FROM g.tenure_start;
  `);

  console.log('Database tables initialized');
}
