import { Hono } from 'hono';
import pool from './db.js';

const api = new Hono();

// 取得台北時區的今日日期 YYYY-MM-DD
const getTaipeiToday = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });

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

// ─── Helper: parse/serialize collaborator IDs ─────────────────────────────────
function parseCollabIds(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(',').filter(Boolean);
}
function serializeCollabIds(ids: string[] | string | null | undefined): string {
  if (!ids) return '';
  if (typeof ids === 'string') return ids;
  return ids.filter(Boolean).join(',');
}

// ─── Schedule ─────────────────────────────────────────────────────────────────
api.get('/schedule', async (c) => {
  const date = c.req.query('date') || getTaipeiToday();
  const { rows } = await pool.query(
    `SELECT
       machine_id AS "machineId",
       operator_id AS "operatorId",
       collaborator_ids AS "collaboratorIds",
       production_items AS "productionItems",
       assigned_date AS "assignedDate",
       GREATEST(($1::date - assigned_date::date), 0) AS "daysAtStation"
     FROM schedule
     WHERE date = $1
     ORDER BY machine_id`,
    [date]
  );
  return c.json(rows.map((r: any) => ({
    ...r,
    collaboratorIds: parseCollabIds(r.collaboratorIds),
  })));
});

api.post('/schedule', async (c) => {
  const { date, machineId, operatorId, collaboratorIds, productionItems, assignedDate } = await c.req.json();
  const collabStr = serializeCollabIds(collaboratorIds);
  await pool.query(
    `INSERT INTO schedule (date, machine_id, operator_id, collaborator_ids, production_items, assigned_date)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (date, machine_id) DO UPDATE SET
       operator_id = $3,
       collaborator_ids = $4,
       production_items = $5,
       assigned_date = $6`,
    [date, machineId, operatorId || null, collabStr, productionItems || '', assignedDate || date]
  );
  return c.json({ ok: true });
});

api.delete('/schedule', async (c) => {
  const { date, machineId } = await c.req.json();
  await pool.query('DELETE FROM schedule WHERE date = $1 AND machine_id = $2', [date, machineId]);
  return c.json({ ok: true });
});

api.post('/schedule/bulk', async (c) => {
  const { date, rows } = await c.req.json<{ date: string; rows: { machineId: string; operatorId?: string; collaboratorIds?: string[]; productionItems?: string; assignedDate?: string }[] }>();
  const machineIds = rows.map((r: { machineId: string }) => r.machineId);
  if (machineIds.length > 0) {
    await pool.query(`DELETE FROM schedule WHERE date = $1 AND machine_id != ALL($2)`, [date, machineIds]);
  } else {
    await pool.query('DELETE FROM schedule WHERE date = $1', [date]);
  }
  for (const r of rows) {
    const collabStr = serializeCollabIds(r.collaboratorIds);
    await pool.query(
      `INSERT INTO schedule (date, machine_id, operator_id, collaborator_ids, production_items, assigned_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (date, machine_id) DO UPDATE SET
         operator_id = $3,
         collaborator_ids = $4,
         production_items = $5,
         assigned_date = $6`,
      [date, r.machineId, r.operatorId || null, collabStr, r.productionItems || '', r.assignedDate || date]
    );
  }
  return c.json({ ok: true });
});

// ─── Overtime Schedule ────────────────────────────────────────────────────────
api.get('/overtime', async (c) => {
  const date = c.req.query('date') || getTaipeiToday();
  const { rows } = await pool.query(
    `SELECT
       machine_id AS "machineId",
       operator_id AS "operatorId",
       collaborator_ids AS "collaboratorIds",
       production_items AS "productionItems"
     FROM overtime_schedule
     WHERE date = $1
     ORDER BY machine_id`,
    [date]
  );
  return c.json(rows.map((r: any) => ({
    ...r,
    collaboratorIds: parseCollabIds(r.collaboratorIds),
  })));
});

api.post('/overtime', async (c) => {
  const { date, machineId, operatorId, collaboratorIds, productionItems } = await c.req.json();
  const collabStr = serializeCollabIds(collaboratorIds);
  await pool.query(
    `INSERT INTO overtime_schedule (date, machine_id, operator_id, collaborator_ids, production_items)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (date, machine_id) DO UPDATE SET
       operator_id = $3,
       collaborator_ids = $4,
       production_items = $5`,
    [date, machineId, operatorId || null, collabStr, productionItems || '']
  );
  return c.json({ ok: true });
});

api.delete('/overtime', async (c) => {
  const { date, machineId } = await c.req.json();
  await pool.query('DELETE FROM overtime_schedule WHERE date = $1 AND machine_id = $2', [date, machineId]);
  return c.json({ ok: true });
});

// Bulk save overtime
api.post('/overtime/bulk', async (c) => {
  const { date, rows } = await c.req.json<{ date: string; rows: { machineId: string; operatorId?: string; collaboratorIds?: string[]; productionItems?: string }[] }>();
  const machineIds = rows.map((r: { machineId: string }) => r.machineId);
  if (machineIds.length > 0) {
    await pool.query(`DELETE FROM overtime_schedule WHERE date = $1 AND machine_id != ALL($2)`, [date, machineIds]);
  } else {
    await pool.query('DELETE FROM overtime_schedule WHERE date = $1', [date]);
  }
  for (const r of rows) {
    const collabStr = serializeCollabIds(r.collaboratorIds);
    await pool.query(
      `INSERT INTO overtime_schedule (date, machine_id, operator_id, collaborator_ids, production_items)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (date, machine_id) DO UPDATE SET
         operator_id = $3,
         collaborator_ids = $4,
         production_items = $5`,
      [date, r.machineId, r.operatorId || null, collabStr, r.productionItems || '']
    );
  }
  return c.json({ ok: true });
});

// Copy daily schedule to overtime
api.post('/overtime/copy-from-schedule', async (c) => {
  const { date } = await c.req.json();
  // Get daily schedule for this date
  const { rows } = await pool.query(
    `SELECT machine_id, operator_id, collaborator_ids, production_items FROM schedule WHERE date = $1`,
    [date]
  );
  // Clear existing overtime for this date
  await pool.query('DELETE FROM overtime_schedule WHERE date = $1', [date]);
  // Insert copies
  for (const r of rows) {
    await pool.query(
      `INSERT INTO overtime_schedule (date, machine_id, operator_id, collaborator_ids, production_items)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (date, machine_id) DO NOTHING`,
      [date, r.machine_id, r.operator_id, r.collaborator_ids || '', r.production_items || '']
    );
  }
  return c.json({ ok: true, copied: rows.length });
});

// ─── Leave ────────────────────────────────────────────────────────────────────
api.get('/leave', async (c) => {
  const date = c.req.query('date') || getTaipeiToday();
  const { rows } = await pool.query(
    'SELECT personnel_id AS "personnelId" FROM leave_records WHERE date = $1',
    [date]
  );
  return c.json(rows.map(r => r.personnelId));
});

api.post('/leave', async (c) => {
  const { date, personnelIds } = await c.req.json<{ date: string; personnelIds: string[] }>();
  await pool.query('DELETE FROM leave_records WHERE date = $1', [date]);
  for (const pid of personnelIds) {
    await pool.query('INSERT INTO leave_records (date, personnel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [date, pid]);
  }
  return c.json({ ok: true });
});

// ─── Sync leave directly (from ServiceJDC or other sources) ─────────────────
api.post('/leave/sync-direct', async (c) => {
  const { records } = await c.req.json<{
    records: { name: string; startDate: string; endDate: string; personnelId?: string }[]
  }>();

  const { rows: allPersonnel } = await pool.query('SELECT id, name FROM personnel');
  const nameToId = new Map<string, string>();
  for (const p of allPersonnel) {
    nameToId.set(p.name, p.id);
  }

  const matched: { id: string; name: string; dates: string[] }[] = [];
  const unmatched: string[] = [];
  let totalInserted = 0;

  for (const rec of records) {
    let pid = rec.personnelId || nameToId.get(rec.name) || '';
    if (!pid) { unmatched.push(rec.name); continue; }

    const parseDate = (s: string) => {
      const m = s.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
    };
    const start = parseDate(rec.startDate);
    const end = parseDate(rec.endDate);
    if (!start || !end) { unmatched.push(rec.name + ' (invalid date)'); continue; }

    const dates: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      dates.push(dateStr);
      const result = await pool.query(
        'INSERT INTO leave_records (date, personnel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [dateStr, pid]
      );
      if (result.rowCount && result.rowCount > 0) totalInserted++;
    }
    matched.push({ id: pid, name: rec.name, dates });
  }

  return c.json({ ok: true, matchedCount: matched.length, unmatchedNames: unmatched, totalInserted, details: matched });
});

export default api;
