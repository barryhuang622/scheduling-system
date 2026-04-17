const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}

// ─── Machines ─────────────────────────────────────────────────────────────────
export const fetchMachines = () => request<{ id: string; name: string }[]>('/machines');

export const saveMachine = (m: { id: string; name: string }) =>
  request('/machines', { method: 'POST', body: JSON.stringify(m) });

export const deleteMachine = (id: string) =>
  request(`/machines/${encodeURIComponent(id)}`, { method: 'DELETE' });

// ─── Personnel ────────────────────────────────────────────────────────────────
export const fetchPersonnel = () =>
  request<{ id: string; name: string; skills: { machineId: string; level: string }[] }[]>('/personnel');

export const savePersonnel = (p: { id: string; name: string; skills: { machineId: string; level: string }[] }) =>
  request('/personnel', { method: 'POST', body: JSON.stringify(p) });

export const deletePersonnel = (id: string) =>
  request(`/personnel/${encodeURIComponent(id)}`, { method: 'DELETE' });

// ─── Schedule ─────────────────────────────────────────────────────────────────
export const fetchSchedule = (date: string) =>
  request<{
    machineId: string;
    operatorId: string | null;
    collaboratorIds: string[];
    productionItems: string;
    assignedDate: string;
    daysAtStation: number;
  }[]>(`/schedule?date=${date}`);

export const saveScheduleRow = (row: {
  date: string;
  machineId: string;
  operatorId: string;
  collaboratorIds: string[];
  productionItems: string;
  assignedDate: string;
}) => request('/schedule', { method: 'POST', body: JSON.stringify(row) });

export const deleteScheduleRow = (date: string, machineId: string) =>
  request('/schedule', { method: 'DELETE', body: JSON.stringify({ date, machineId }) });

export const bulkSaveSchedule = (date: string, rows: {
  machineId: string;
  operatorId?: string;
  collaboratorIds?: string[];
  productionItems?: string;
  assignedDate?: string;
}[]) => request('/schedule/bulk', { method: 'POST', body: JSON.stringify({ date, rows }) });

// ─── Overtime Schedule ────────────────────────────────────────────────────────
export const fetchOvertime = (date: string) =>
  request<{
    machineId: string;
    operatorId: string | null;
    collaboratorIds: string[];
    productionItems: string;
  }[]>(`/overtime?date=${date}`);

export const saveOvertimeRow = (row: {
  date: string;
  machineId: string;
  operatorId: string;
  collaboratorIds: string[];
  productionItems: string;
}) => request('/overtime', { method: 'POST', body: JSON.stringify(row) });

export const deleteOvertimeRow = (date: string, machineId: string) =>
  request('/overtime', { method: 'DELETE', body: JSON.stringify({ date, machineId }) });

export const bulkSaveOvertime = (date: string, rows: {
  machineId: string;
  operatorId?: string;
  collaboratorIds?: string[];
  productionItems?: string;
}[]) => request('/overtime/bulk', { method: 'POST', body: JSON.stringify({ date, rows }) });

export const copyScheduleToOvertime = (date: string) =>
  request<{ ok: boolean; copied: number }>('/overtime/copy-from-schedule', { method: 'POST', body: JSON.stringify({ date }) });

// ─── Leave ────────────────────────────────────────────────────────────────────
export const fetchLeave = (date: string) =>
  request<string[]>(`/leave?date=${date}`);

export const saveLeave = (date: string, personnelIds: string[]) =>
  request('/leave', { method: 'POST', body: JSON.stringify({ date, personnelIds }) });

export const syncLeaveFromSheet = (date: string, sheetUrl: string) =>
  request<{ ok: boolean; synced: number; matched: { id: string; name: string }[]; error?: string }>(
    '/leave/sync-from-sheet', { method: 'POST', body: JSON.stringify({ date, sheetUrl }) }
  );
