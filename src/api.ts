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
    collaboratorId: string | null;
    productionItems: string;
    assignedDate: string;
    daysAtStation: number;
  }[]>(`/schedule?date=${date}`);

export const saveScheduleRow = (row: {
  date: string;
  machineId: string;
  operatorId: string;
  collaboratorId: string;
  productionItems: string;
  assignedDate: string;
}) => request('/schedule', { method: 'POST', body: JSON.stringify(row) });

export const deleteScheduleRow = (date: string, machineId: string) =>
  request('/schedule', { method: 'DELETE', body: JSON.stringify({ date, machineId }) });

export const bulkSaveSchedule = (date: string, rows: {
  machineId: string;
  operatorId?: string;
  collaboratorId?: string;
  productionItems?: string;
  assignedDate?: string;
}[]) => request('/schedule/bulk', { method: 'POST', body: JSON.stringify({ date, rows }) });

// ─── Leave ────────────────────────────────────────────────────────────────────
export const fetchLeave = (date: string) =>
  request<string[]>(`/leave?date=${date}`);

export const saveLeave = (date: string, personnelIds: string[]) =>
  request('/leave', { method: 'POST', body: JSON.stringify({ date, personnelIds }) });
