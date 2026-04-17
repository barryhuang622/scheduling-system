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
  const date = c.req.query('date') || new Date().toISOString().split('T')[0];
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
  const date = c.req.query('date') || new Date().toISOString().split('T')[0];
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
  const date = c.req.query('date') || new Date().toISOString().split('T')[0];
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

// ─── Sync leave from Google Sheet ────────────────────────────────────────────
api.post('/leave/sync-from-sheet', async (c) => {
  const { date, sheetUrl } = await c.req.json<{ date: string; sheetUrl: string }>();

  // Extract sheet ID from URL
  const match = sheetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return c.json({ ok: false, error: '無效的試算表連結' }, 400);
  const sheetId = match[1];

  // Fetch CSV from public Google Sheet
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  const res = await fetch(csvUrl);
  if (!res.ok) return c.json({ ok: false, error: '無法讀取試算表，請確認已設為公開' }, 502);
  const csv = await res.text();

  // Parse CSV
  const lines = csv.split('\n').map(line => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { cells.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    cells.push(current.trim());
    return cells;
  });

  if (lines.length < 2) return c.json({ ok: false, error: '試算表沒有資料' }, 400);

  const header = lines[0].map(h => h.replace(/\uFEFF/, '').trim());
  const deptIdx = header.findIndex(h => h.includes('部門'));
  const nameIdx = header.findIndex(h => h.includes('姓名'));
  const startIdx = header.findIndex(h => h.includes('開始'));
  const endIdx = header.findIndex(h => h.includes('結束'));
  const statusIdx = header.findIndex(h => h.includes('狀態'));
  const idIdx = header.findIndex(h => h.includes('帳號') || h.includes('編號') || h === 'ID');

  if (nameIdx === -1 || startIdx === -1 || endIdx === -1) {
    return c.json({ ok: false, error: '試算表缺少必要欄位（姓名、開始時間、結束時間）' }, 400);
  }

  // Parse target date
  const targetDate = new Date(date + 'T00:00:00');

  // Get all personnel from DB for name matching
  const { rows: allPersonnel } = await pool.query('SELECT id, name FROM personnel');
  const nameToId = new Map<string, string>();
  for (const p of allPersonnel) {
    nameToId.set(p.name, p.id);
  }

  // Filter rows: 製造部 + date in range + approved status
  const leavePersonnelIds: string[] = [];
  const matched: { id: string; name: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i];
    if (cells.length < Math.max(nameIdx, startIdx, endIdx) + 1) continue;

    const dept = deptIdx >= 0 ? cells[deptIdx] : '';
    const name = cells[nameIdx];
    const startStr = cells[startIdx];
    const endStr = cells[endIdx];
    const status = statusIdx >= 0 ? cells[statusIdx] : '已生效';

    // Only 製造部 if department column exists
    if (deptIdx >= 0 && !dept.includes('製造')) continue;

    // Only approved leave
    if (status && !status.includes('生效') && !status.includes('核准') && !status.includes('approved')) continue;

    // Parse dates (support formats: 2026/04/17, 2026-04-17, 2026/04/17 08:00)
    const parseDate = (s: string) => {
      const m = s.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
    };

    const start = parseDate(startStr);
    const end = parseDate(endStr);
    if (!start || !end) continue;

    // Check if target date falls within leave period
    if (targetDate < start || targetDate > end) continue;

    // Match personnel: try ID column first, then name
    let pid = '';
    if (idIdx >= 0 && cells[idIdx]) {
      pid = cells[idIdx];
    } else {
      pid = nameToId.get(name) || '';
    }

    if (pid) {
      leavePersonnelIds.push(pid);
      matched.push({ id: pid, name });
    }
  }

  // Update leave records (merge with existing manual entries)
  const { rows: existing } = await pool.query(
    'SELECT personnel_id FROM leave_records WHERE date = $1', [date]
  );
  const existingSet = new Set(existing.map(r => r.personnel_id));

  for (const pid of leavePersonnelIds) {
    if (!existingSet.has(pid)) {
      await pool.query('INSERT INTO leave_records (date, personnel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [date, pid]);
    }
  }

  return c.json({ ok: true, synced: matched.length, matched, total: leavePersonnelIds.length });
});

export default api;
