import { Hono } from 'hono';
import pool from './db.js';

const api = new Hono();

// ─── Machines ─────────────────────────────────────────────────────────────────
api.get('/machines', async (c) => {
  const { rows } = await pool.query('SELECT id, name FROM machines ORDER BY id');
  return c.json(rows);
});

api.post('/machines', async (c) => {
  const { id, name } = await c.req.json();
  await pool.query('INSERT INTO machines (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = $2', [id, name]);
  // Create skill entries for all existing personnel
  const { rows: people } = await pool.query('SELECT id FROM personnel');
  for (const p of people) {
    await pool.query('INSERT INTO skills (personnel_id, machine_id, level) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [p.id, id, 'none']);
  }
  return c.json({ ok: true });
});

api.delete('/machines/:id', async (c) => {
  const id = c.req.param('id');
  await pool.query('DELETE FROM machines WHERE id = $1', [id]);
  return c.json({ ok: true });
});

// ─── Personnel ────────────────────────────────────────────────────────────────
api.get('/personnel', async (c) => {
  const { rows: people } = await pool.query('SELECT id, name FROM personnel ORDER BY id');
  // Fetch skills for each person
  const result = [];
  for (const p of people) {
    const { rows: skills } = await pool.query(
      'SELECT machine_id AS "machineId", level FROM skills WHERE personnel_id = $1 ORDER BY machine_id',
      [p.id]
    );
    result.push({ ...p, skills });
  }
  return c.json(result);
});

api.post('/personnel', async (c) => {
  const { id, name, skills } = await c.req.json();
  await pool.query('INSERT INTO personnel (id, name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET name = $2', [id, name]);
  // Upsert skills
  if (skills && Array.isArray(skills)) {
    for (const s of skills) {
      await pool.query(
        'INSERT INTO skills (personnel_id, machine_id, level) VALUES ($1, $2, $3) ON CONFLICT (personnel_id, machine_id) DO UPDATE SET level = $3',
        [id, s.machineId, s.level]
      );
    }
  }
  return c.json({ ok: true });
});

api.delete('/personnel/:id', async (c) => {
  const id = c.req.param('id');
  await pool.query('DELETE FROM personnel WHERE id = $1', [id]);
  return c.json({ ok: true });
});

// ─── Schedule ─────────────────────────────────────────────────────────────────
// GET /schedule?date=2026-04-17
// Returns rows with auto-calculated daysAtStation
api.get('/schedule', async (c) => {
  const date = c.req.query('date') || new Date().toISOString().split('T')[0];
  const { rows } = await pool.query(
    `SELECT
       machine_id AS "machineId",
       operator_id AS "operatorId",
       collaborator_id AS "collaboratorId",
       production_items AS "productionItems",
       assigned_date AS "assignedDate",
       GREATEST(($1::date - assigned_date::date), 0) AS "daysAtStation"
     FROM schedule
     WHERE date = $1
     ORDER BY machine_id`,
    [date]
  );
  return c.json(rows);
});

// Save/update a single schedule row
api.post('/schedule', async (c) => {
  const { date, machineId, operatorId, collaboratorId, productionItems, assignedDate } = await c.req.json();
  await pool.query(
    `INSERT INTO schedule (date, machine_id, operator_id, collaborator_id, production_items, assigned_date)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (date, machine_id) DO UPDATE SET
       operator_id = $3,
       collaborator_id = $4,
       production_items = $5,
       assigned_date = $6`,
    [date, machineId, operatorId || null, collaboratorId || null, productionItems || '', assignedDate || date]
  );
  return c.json({ ok: true });
});

// Remove a machine from a day's schedule
api.delete('/schedule', async (c) => {
  const { date, machineId } = await c.req.json();
  await pool.query('DELETE FROM schedule WHERE date = $1 AND machine_id = $2', [date, machineId]);
  return c.json({ ok: true });
});

// Bulk save schedule (when confirming machine picker)
api.post('/schedule/bulk', async (c) => {
  const { date, rows } = await c.req.json<{ date: string; rows: { machineId: string; operatorId?: string; collaboratorId?: string; productionItems?: string; assignedDate?: string }[] }>();
  // Remove rows for this date that are not in the new list
  const machineIds = rows.map((r: { machineId: string }) => r.machineId);
  if (machineIds.length > 0) {
    await pool.query(
      `DELETE FROM schedule WHERE date = $1 AND machine_id != ALL($2)`,
      [date, machineIds]
    );
  } else {
    await pool.query('DELETE FROM schedule WHERE date = $1', [date]);
  }
  // Upsert each row
  for (const r of rows) {
    await pool.query(
      `INSERT INTO schedule (date, machine_id, operator_id, collaborator_id, production_items, assigned_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (date, machine_id) DO UPDATE SET
         operator_id = $3,
         collaborator_id = $4,
         production_items = $5,
         assigned_date = $6`,
      [date, r.machineId, r.operatorId || null, r.collaboratorId || null, r.productionItems || '', r.assignedDate || date]
    );
  }
  return c.json({ ok: true });
});

// ─── Leave ────────────────────────────────────────────────────────────────────
api.get('/leave', async (c) => {
  const date = c.req.query('date') || new Date().toISOString().split('T')[0];
  const { rows } = await pool.query(
    'SELECT personnel_id AS "personnelId" FROM leave_records WHERE date = $1',
    [date]
  );
  return c.json(rows.map(r => r.personnelId));
});

api.post('/leave', async (c) => {
  const { date, personnelIds } = await c.req.json<{ date: string; personnelIds: string[] }>();
  // Replace all leave for this date
  await pool.query('DELETE FROM leave_records WHERE date = $1', [date]);
  for (const pid of personnelIds) {
    await pool.query('INSERT INTO leave_records (date, personnel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [date, pid]);
  }
  return c.json({ ok: true });
});

export default api;
