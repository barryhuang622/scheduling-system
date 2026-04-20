import { useState, useEffect, useCallback, useRef } from 'react';
import type { Machine, OvertimeRow, Personnel, Role, ScheduleRow, SkillLevel, TabType, User } from './types';
import * as api from './api';
import {
  Users, CalendarDays, AlertTriangle,
  Brain, Plus, Trash2, Edit3, Check, X, ChevronDown, ChevronUp,
  ClockAlert, Shuffle, UserX, Factory, Settings2, UserPlus,
  LogIn, LogOut, Shield, Lock, Eye, Clock, Copy
} from 'lucide-react';
import './index.css';

// ─── Auth (demo accounts) ────────────────────────────────────────────────────
const ACCOUNTS: Record<string, { password: string; role: Role; displayName: string }> = {
  admin:  { password: 'admin123',  role: 'admin',     displayName: '系統管理員' },
  staff:  { password: 'staff123',  role: 'scheduler', displayName: '排班人員' },
  staff2: { password: 'staff456',  role: 'scheduler', displayName: '排班副手' },
};

const ROLE_LABELS: Record<Role, string> = {
  viewer:    '瀏覽人員',
  scheduler: '排班人員',
  admin:     '最高管理員',
};

const ROLE_BADGE_COLORS: Record<Role, string> = {
  viewer:    'bg-gray-100 text-gray-600 border-gray-300',
  scheduler: 'bg-blue-100 text-blue-700 border-blue-300',
  admin:     'bg-violet-100 text-violet-700 border-violet-300',
};

// ─── Skill level helpers ──────────────────────────────────────────────────────
const SKILL_LABELS: Record<SkillLevel, string> = {
  expert: '熟練',
  competent: '會',
  learning: '學習中',
  none: '不會',
};
const SKILL_COLORS: Record<SkillLevel, string> = {
  expert: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
  competent: 'bg-blue-100 text-blue-800 border border-blue-300',
  learning: 'bg-amber-100 text-amber-800 border border-amber-300',
  none: 'bg-gray-100 text-gray-500 border border-gray-200',
};

const ALERT_DAYS = 30;

// ─── AI Scheduling logic ──────────────────────────────────────────────────────
interface Suggestion {
  machineId: string;
  machineName: string;
  currentOperatorId: string;
  currentOperatorName: string;
  suggestedOperatorId: string;
  suggestedOperatorName: string;
  reason: string;
  daysAtStation: number;
}

function generateAISuggestions(
  rows: ScheduleRow[],
  personnel: Personnel[],
  machines: Machine[],
  leaveIds: string[]
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const personMap = new Map(personnel.map(p => [p.id, p]));
  const machineMap = new Map(machines.map(m => [m.id, m]));
  const longStayRows = rows.filter(r => r.daysAtStation >= ALERT_DAYS);
  const leaveSet = new Set(leaveIds);

  for (const row of longStayRows) {
    const currentOp = personMap.get(row.operatorId);
    if (!currentOp) continue;
    const machine = machineMap.get(row.machineId);
    if (!machine) continue;

    const longStayOpIds = new Set(longStayRows.map(r => r.operatorId));
    const candidates = personnel.filter(p => {
      if (p.id === row.operatorId) return false;
      if (leaveSet.has(p.id)) return false;
      const skill = p.skills.find(s => s.machineId === row.machineId);
      return skill && skill.level !== 'none';
    });

    const preferred = candidates.filter(c => !longStayOpIds.has(c.id));
    const pick = preferred[0] || candidates[0];

    if (pick) {
      const skill = pick.skills.find(s => s.machineId === row.machineId)!;
      suggestions.push({
        machineId: row.machineId,
        machineName: machine.name,
        currentOperatorId: row.operatorId,
        currentOperatorName: currentOp.name,
        suggestedOperatorId: pick.id,
        suggestedOperatorName: pick.name,
        reason: `${currentOp.name} 已在此機台 ${row.daysAtStation} 天（超過 ${ALERT_DAYS} 天門檻）。${pick.name} 具備「${SKILL_LABELS[skill.level]}」等級技能，適合接任以促進技能交叉訓練。`,
        daysAtStation: row.daysAtStation,
      });
    }
  }
  return suggestions;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkillBadge({ level }: { level: SkillLevel }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${SKILL_COLORS[level]}`}>
      {SKILL_LABELS[level]}
    </span>
  );
}

function PersonnelModal({
  person, machines, onSave, onClose,
}: {
  person: Personnel | null;
  machines: Machine[];
  onSave: (p: Personnel) => void;
  onClose: () => void;
}) {
  const isNew = !person;
  const [name, setName] = useState(person?.name ?? '');
  const [id, setId] = useState(person?.id ?? `P${String(Math.floor(Math.random() * 900) + 100)}`);
  const [skills, setSkills] = useState<Record<string, SkillLevel>>(
    person
      ? Object.fromEntries(person.skills.map(s => [s.machineId, s.level]))
      : Object.fromEntries(machines.map(m => [m.id, 'none' as SkillLevel]))
  );

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id, name: name.trim(),
      skills: machines.map(m => ({ machineId: m.id, level: skills[m.id] ?? 'none' })),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">{isNew ? '新增人員' : '編輯人員'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">代號</label>
              <input value={id} onChange={e => setId(e.target.value)} disabled={!isNew}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">姓名</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="請輸入姓名"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">機台技能評估（{machines.length} 台）</label>
            <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
              {machines.map(m => (
                <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-sm text-gray-700 w-36">
                    <span className="font-mono text-xs text-gray-400">{m.id}</span>　{m.name}
                  </span>
                  <div className="flex gap-1">
                    {(['expert', 'competent', 'learning', 'none'] as SkillLevel[]).map(lvl => (
                      <button key={lvl} onClick={() => setSkills(prev => ({ ...prev, [m.id]: lvl }))}
                        className={`px-2 py-0.5 rounded text-xs font-medium border transition-all ${
                          skills[m.id] === lvl
                            ? SKILL_COLORS[lvl] + ' ring-2 ring-offset-1 ring-blue-400'
                            : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                        }`}>
                        {SKILL_LABELS[lvl]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">取消</button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">儲存</button>
        </div>
      </div>
    </div>
  );
}

function MachineModal({
  machine, existingIds, onSave, onClose,
}: {
  machine: Machine | null;
  existingIds: string[];
  onSave: (m: Machine) => void;
  onClose: () => void;
}) {
  const isNew = !machine;
  const [id, setId] = useState(machine?.id ?? '');
  const [name, setName] = useState(machine?.name ?? '');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!id.trim()) { setError('請輸入機台號碼'); return; }
    if (!name.trim()) { setError('請輸入機台名稱'); return; }
    if (isNew && existingIds.includes(id.trim())) { setError('此機台號碼已存在'); return; }
    onSave({ id: id.trim(), name: name.trim() });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">{isNew ? '新增機台' : '編輯機台'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">機台號碼</label>
            <input value={id} onChange={e => { setId(e.target.value); setError(''); }} disabled={!isNew}
              placeholder="例如 M31"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50 disabled:text-gray-400 font-mono" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">機台名稱</label>
            <input value={name} onChange={e => { setName(e.target.value); setError(''); }} placeholder="例如 CNC車床D"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">取消</button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">儲存</button>
        </div>
      </div>
    </div>
  );
}

function MachinePickerModal({
  machines, currentMachineIds, onConfirm, onClose,
}: {
  machines: Machine[];
  currentMachineIds: string[];
  onConfirm: (selected: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentMachineIds));

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Factory size={18} className="text-blue-600" />
            <h3 className="font-semibold text-gray-800">選擇今日使用機台</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 flex items-center justify-between">
          <span>已選擇 {selected.size} / {machines.length} 台機台</span>
          <div className="flex gap-2">
            <button onClick={() => setSelected(new Set(machines.map(m => m.id)))} className="text-xs underline hover:text-blue-900">全選</button>
            <button onClick={() => setSelected(new Set())} className="text-xs underline hover:text-blue-900">清空</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {machines.map(m => {
              const isSelected = selected.has(m.id);
              const wasInSchedule = currentMachineIds.includes(m.id);
              return (
                <button key={m.id} onClick={() => toggle(m.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left border transition-all ${
                    isSelected ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400'
                  }`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                  }`}>
                    {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-gray-400">{m.id}</div>
                    <div className="text-sm font-medium truncate">{m.name}</div>
                  </div>
                  {wasInSchedule && !isSelected && <span className="text-xs text-orange-500">移除</span>}
                  {!wasInSchedule && isSelected && <span className="text-xs text-emerald-600">+ 新增</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">取消</button>
          <button onClick={() => onConfirm(Array.from(selected))} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">確認</button>
        </div>
      </div>
    </div>
  );
}

function LeavePickerModal({
  personnel, currentLeaveIds, onConfirm, onClose,
}: {
  personnel: Personnel[];
  currentLeaveIds: string[];
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentLeaveIds));

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <UserX size={18} className="text-rose-500" />
            <h3 className="font-semibold text-gray-800">設定休假人員</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-3 bg-rose-50 border-b border-rose-100 text-xs text-rose-700">
          已選擇 {selected.size} 人休假
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
          {personnel.map(p => {
            const isSelected = selected.has(p.id);
            return (
              <button key={p.id} onClick={() => toggle(p.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left border transition-all ${
                  isSelected ? 'border-rose-300 bg-rose-50' : 'border-gray-200 bg-white hover:border-gray-400'
                }`}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'border-rose-500 bg-rose-500' : 'border-gray-300'
                }`}>
                  {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
                </div>
                <span className="text-xs font-mono text-gray-400">{p.id}</span>
                <span className="font-medium text-gray-800 flex-1">{p.name}</span>
              </button>
            );
          })}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">取消</button>
          <button onClick={() => onConfirm(Array.from(selected))} className="px-4 py-2 bg-rose-500 text-white text-sm rounded-lg hover:bg-rose-600">確認</button>
        </div>
      </div>
    </div>
  );
}

function AISuggestionPanel({
  suggestions, onApply, onClose,
}: {
  suggestions: Suggestion[];
  onApply: (s: Suggestion) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-violet-600" />
            <h3 className="font-semibold text-gray-800">AI 智慧排班建議</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-5 py-3 bg-violet-50 border-b border-violet-100 text-xs text-violet-700">
          系統分析在崗超過 {ALERT_DAYS} 天的人員，排除休假人員，根據技能適配度建議調動方案。
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {suggestions.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Check size={40} className="mx-auto mb-2 text-emerald-400" />
              <p className="font-medium text-gray-600">目前無需調動</p>
              <p className="text-sm mt-1">所有人員在崗天數均在合理範圍內</p>
            </div>
          ) : (
            suggestions.map(s => (
              <div key={s.machineId} className="border border-orange-200 rounded-xl p-4 bg-orange-50">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-800">{s.machineName}</span>
                      <span className="text-xs bg-red-100 text-red-700 border border-red-200 rounded px-2 py-0.5">
                        在崗 {s.daysAtStation} 天
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm mb-2">
                      <div className="flex items-center gap-1.5 bg-white border border-red-200 rounded-lg px-2.5 py-1">
                        <span className="text-gray-400 text-xs">現任</span>
                        <span className="text-red-600 font-medium line-through">{s.currentOperatorName}</span>
                      </div>
                      <span className="text-gray-400">→</span>
                      <div className="flex items-center gap-1.5 bg-white border border-emerald-200 rounded-lg px-2.5 py-1">
                        <span className="text-gray-400 text-xs">建議</span>
                        <span className="text-emerald-700 font-medium">{s.suggestedOperatorName}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{s.reason}</p>
                  </div>
                  <button onClick={() => onApply(s)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 font-medium">
                    <Shuffle size={13} />套用
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="px-5 py-4 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">關閉</button>
        </div>
      </div>
    </div>
  );
}

function LoginModal({ onLogin, onClose }: { onLogin: (user: User) => void; onClose: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const account = ACCOUNTS[username.trim().toLowerCase()];
    if (!account || account.password !== password) {
      setError('帳號或密碼錯誤');
      return;
    }
    onLogin({
      username: username.trim().toLowerCase(),
      role: account.role,
      displayName: account.displayName,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-blue-600" />
            <h3 className="font-semibold text-gray-800">系統登入</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">帳號</label>
            <input
              autoFocus
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              placeholder="請輸入帳號"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">密碼</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="請輸入密碼"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">取消</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">登入</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Date helpers (台北時區) ──────────────────────────────────────────────────
// 台灣是 UTC+8。直接用 toISOString() 會回傳 UTC 日期，凌晨時段會拿到昨天，
// 因此統一用 Asia/Taipei 時區的 YYYY-MM-DD。
const getTaipeiToday = () => {
  // en-CA 會輸出 YYYY-MM-DD 格式
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const today = getTaipeiToday();
  const [tab, setTab] = useState<TabType>('schedule');
  const [machines, setMachines] = useState<Machine[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [scheduleDate, setScheduleDate] = useState(today);
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [leaveIds, setLeaveIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Auth state ──
  const [user, setUser] = useState<User | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const role: Role = user?.role ?? 'viewer';
  const canEdit = role === 'admin' || role === 'scheduler';
  const canDelete = role === 'admin';
  const canAccessNonScheduleTab = role === 'admin' || role === 'scheduler';

  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null | 'new'>(null);
  const [editingMachine, setEditingMachine] = useState<Machine | null | 'new'>(null);
  const [showAI, setShowAI] = useState(false);
  const [showMachinePicker, setShowMachinePicker] = useState(false);
  const [showLeavePicker, setShowLeavePicker] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Suggestion[]>([]);
  const [expandedPersonnel, setExpandedPersonnel] = useState<string | null>(null);

  const [editingRowMachine, setEditingRowMachine] = useState<string | null>(null);
  const [editingRowData, setEditingRowData] = useState<Partial<ScheduleRow>>({});

  // ── Overtime state ──
  const [overtimeRows, setOvertimeRows] = useState<OvertimeRow[]>([]);
  const [editingOtMachine, setEditingOtMachine] = useState<string | null>(null);
  const [editingOtData, setEditingOtData] = useState<Partial<OvertimeRow>>({});
  const [showOtMachinePicker, setShowOtMachinePicker] = useState(false);

  // ── Data fetching ──
  const refreshMachines = useCallback(async () => {
    const data = await api.fetchMachines();
    setMachines(data);
  }, []);

  const refreshPersonnel = useCallback(async () => {
    const data = await api.fetchPersonnel();
    setPersonnel(data.map(p => ({
      ...p,
      skills: p.skills.map(s => ({ ...s, level: s.level as SkillLevel })),
    })));
  }, []);

  const refreshSchedule = useCallback(async (date: string) => {
    const [schedData, leaveData] = await Promise.all([
      api.fetchSchedule(date),
      api.fetchLeave(date),
    ]);
    setRows(schedData.map(r => ({
      machineId: r.machineId,
      operatorId: r.operatorId ?? '',
      collaboratorIds: r.collaboratorIds ?? [],
      productionItems: r.productionItems,
      assignedDate: r.assignedDate,
      daysAtStation: r.daysAtStation,
    })));
    setLeaveIds(leaveData);
  }, []);

  const refreshOvertime = useCallback(async (date: string) => {
    const data = await api.fetchOvertime(date);
    setOvertimeRows(data.map(r => ({
      machineId: r.machineId,
      operatorId: r.operatorId ?? '',
      collaboratorIds: r.collaboratorIds ?? [],
      productionItems: r.productionItems,
    })));
  }, []);

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([refreshMachines(), refreshPersonnel(), refreshSchedule(scheduleDate), refreshOvertime(scheduleDate)]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload schedule when date changes
  useEffect(() => {
    refreshSchedule(scheduleDate);
    refreshOvertime(scheduleDate);
  }, [scheduleDate, refreshSchedule, refreshOvertime]);

  // 當使用者手動挑過日期後，userPickedDate 會變 true，這之後所有自動更新都停止，
  // 避免排班排到一半突然跳回今天。
  const userPickedDateRef = useRef(false);

  // 只有在使用者「還沒手動挑過日期」時才自動更新：
  //   1. 元件掛載時（第一次打開頁面）
  //   2. 從手機背景切回來 (visibilitychange / pageshow)
  // 一旦使用者動過日期選擇器，就完全不自動變動。
  useEffect(() => {
    const updateToTodayIfUntouched = () => {
      if (userPickedDateRef.current) return;
      const todayStr = getTaipeiToday();
      setScheduleDate(prev => (prev === todayStr ? prev : todayStr));
    };
    updateToTodayIfUntouched();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') updateToTodayIfUntouched();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', updateToTodayIfUntouched);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', updateToTodayIfUntouched);
    };
  }, []);

  const handleLogout = () => {
    setUser(null);
    setTab('schedule');
    setEditingRowMachine(null);
    setEditingPersonnel(null);
    setEditingMachine(null);
  };

  const handleLogin = (u: User) => {
    setUser(u);
    setShowLogin(false);
    // 登入時自動跳到今天日期（台北時區），並重設手動選擇旗標
    userPickedDateRef.current = false;
    const todayStr = getTaipeiToday();
    if (scheduleDate !== todayStr) {
      setScheduleDate(todayStr);
    }
  };

  const personMap = new Map(personnel.map(p => [p.id, p]));
  const machineMap = new Map(machines.map(m => [m.id, m]));
  const leaveSet = new Set(leaveIds);
  const alertRows = rows.filter(r => r.daysAtStation >= ALERT_DAYS);
  const onLeaveList = personnel.filter(p => leaveSet.has(p.id));
  const conflictRows = rows.filter(r =>
    leaveSet.has(r.operatorId) || r.collaboratorIds.some(id => leaveSet.has(id))
  );

  const handleRunAI = () => {
    setAiSuggestions(generateAISuggestions(rows, personnel, machines, leaveIds));
    setShowAI(true);
  };

  const handleApplySuggestion = useCallback(async (s: Suggestion) => {
    const row = rows.find(r => r.machineId === s.machineId);
    if (!row) return;
    await api.saveScheduleRow({
      date: scheduleDate,
      machineId: s.machineId,
      operatorId: s.suggestedOperatorId,
      collaboratorIds: row.collaboratorIds,
      productionItems: row.productionItems,
      assignedDate: scheduleDate,
    });
    setAiSuggestions(prev => prev.filter(x => x.machineId !== s.machineId));
    await refreshSchedule(scheduleDate);
  }, [scheduleDate, rows, refreshSchedule]);

  const handleSavePersonnel = async (p: Personnel) => {
    await api.savePersonnel(p);
    await refreshPersonnel();
    setEditingPersonnel(null);
  };

  const handleSaveMachine = async (m: Machine) => {
    await api.saveMachine(m);
    await Promise.all([refreshMachines(), refreshPersonnel()]);
    setEditingMachine(null);
  };

  const handleDeleteMachine = async (id: string) => {
    if (rows.some(r => r.machineId === id)) {
      alert('此機台仍在今日排班中，請先從排班移除');
      return;
    }
    if (!confirm('確定刪除此機台？所有人員技能紀錄中的此機台也會被移除。')) return;
    await api.deleteMachine(id);
    await Promise.all([refreshMachines(), refreshPersonnel()]);
  };

  const startEditRow = (row: ScheduleRow) => {
    setEditingRowMachine(row.machineId);
    setEditingRowData({ ...row });
  };

  const saveEditRow = async () => {
    if (!editingRowMachine) return;
    const original = rows.find(r => r.machineId === editingRowMachine);
    if (!original) return;
    const merged = { ...original, ...editingRowData };
    await api.saveScheduleRow({
      date: scheduleDate,
      machineId: merged.machineId,
      operatorId: merged.operatorId,
      collaboratorIds: merged.collaboratorIds,
      productionItems: merged.productionItems,
      assignedDate: merged.assignedDate,
    });
    setEditingRowMachine(null);
    setEditingRowData({});
    await refreshSchedule(scheduleDate);
  };

  const handleMachinePickerConfirm = async (selected: string[]) => {
    const bulkRows = selected.map(id => {
      const existing = rows.find(r => r.machineId === id);
      if (existing) {
        return {
          machineId: id,
          operatorId: existing.operatorId || undefined,
          collaboratorIds: existing.collaboratorIds.length > 0 ? existing.collaboratorIds : undefined,
          productionItems: existing.productionItems || undefined,
          assignedDate: existing.assignedDate || undefined,
        };
      }
      return { machineId: id };
    });
    await api.bulkSaveSchedule(scheduleDate, bulkRows);
    setShowMachinePicker(false);
    await refreshSchedule(scheduleDate);
  };

  const removeRow = async (machineId: string) => {
    await api.deleteScheduleRow(scheduleDate, machineId);
    await refreshSchedule(scheduleDate);
  };

  const removeFromLeave = async (id: string) => {
    const newLeave = leaveIds.filter(x => x !== id);
    await api.saveLeave(scheduleDate, newLeave);
    setLeaveIds(newLeave);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">生產排班系統</h1>
            <p className="text-xs text-gray-400 mt-0.5">Manufacturing Schedule & Personnel Management</p>
          </div>
          <div className="flex items-center gap-3">
            {canEdit && alertRows.length > 0 && (
              <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 text-orange-700 text-xs px-3 py-1.5 rounded-lg">
                <AlertTriangle size={13} />
                <span>{alertRows.length} 位人員超過 {ALERT_DAYS} 天未調動</span>
              </div>
            )}
            <span className="text-xs text-gray-400">{scheduleDate}</span>

            {/* Role / Login */}
            {user ? (
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${ROLE_BADGE_COLORS[role]}`}>
                  {role === 'admin' ? <Shield size={12} /> : <UserPlus size={12} />}
                  <span className="font-medium">{ROLE_LABELS[role]}</span>
                  <span className="opacity-60">·</span>
                  <span>{user.displayName}</span>
                </div>
                <button onClick={handleLogout}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <LogOut size={12} />登出
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${ROLE_BADGE_COLORS.viewer}`}>
                  <Eye size={12} />
                  <span className="font-medium">瀏覽模式</span>
                </div>
                <button onClick={() => setShowLogin(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                  <LogIn size={12} />登入
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 flex gap-0">
          {[
            { key: 'schedule', label: '每日排班', icon: <CalendarDays size={14} />, requireAuth: false },
            { key: 'overtime', label: '加班排班', icon: <Clock size={14} />, requireAuth: false },
            { key: 'personnel', label: '人員資料庫', icon: <Users size={14} />, requireAuth: true },
            { key: 'machine', label: '機台資料庫', icon: <Settings2 size={14} />, requireAuth: true },
          ].filter(t => !t.requireAuth || canAccessNonScheduleTab).map(t => (
            <button key={t.key} onClick={() => setTab(t.key as TabType)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-6">

        {loading && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg font-medium text-gray-600">載入中…</p>
          </div>
        )}

        {/* ══ Schedule Tab ══ */}
        {!loading && tab === 'schedule' && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-500">排班日期</label>
                <input type="date" value={scheduleDate}
                  onChange={e => { userPickedDateRef.current = true; setScheduleDate(e.target.value); }}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                {canEdit && (
                  <button onClick={() => setShowMachinePicker(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 bg-white text-sm text-gray-700 rounded-lg hover:bg-gray-50">
                    <Factory size={14} />選擇機台
                    <span className="bg-blue-100 text-blue-700 text-xs rounded-full px-2 py-0.5 ml-1">{rows.length}</span>
                  </button>
                )}
              </div>
              {canEdit && (
                <button onClick={handleRunAI}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 shadow-sm">
                  <Brain size={15} />AI 智慧排班
                </button>
              )}
            </div>

            {!canEdit && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 flex items-center gap-2">
                <Eye size={14} />
                <span>您目前以瀏覽模式查看排班，僅能檢視內容。如需編輯請點右上角「登入」。</span>
              </div>
            )}

            {/* Leave personnel section */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <UserX size={15} className="text-rose-500" />
                  <span className="text-sm font-semibold text-gray-700">當天休假人員</span>
                  <span className="text-xs bg-rose-50 text-rose-600 border border-rose-200 rounded-full px-2 py-0.5">
                    {leaveIds.length} 人
                  </span>
                </div>
                {canEdit && (
                  <button onClick={() => setShowLeavePicker(true)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-rose-600 border border-rose-200 bg-rose-50 rounded-lg hover:bg-rose-100">
                    <UserPlus size={13} />設定休假
                  </button>
                )}
              </div>
              {onLeaveList.length === 0 ? (
                <p className="text-sm text-gray-400 italic">今日無人休假</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {onLeaveList.map(p => (
                    <div key={p.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-rose-50 border border-rose-200">
                      <span className="text-xs font-mono text-gray-500">{p.id}</span>
                      <span className="font-medium text-gray-800">{p.name}</span>
                      {canEdit && (
                        <button onClick={() => removeFromLeave(p.id)} className="text-rose-400 hover:text-rose-600 ml-0.5" title="取消休假">
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {canEdit && conflictRows.length > 0 && (
                <div className="mt-3 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-xs text-rose-700 flex items-start gap-2">
                  <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                  <span>
                    <span className="font-semibold">注意：</span>
                    {conflictRows.map(r => {
                      const m = machineMap.get(r.machineId);
                      const conflictPeople = [r.operatorId, ...r.collaboratorIds]
                        .filter(id => id && leaveSet.has(id))
                        .map(id => personMap.get(id!)?.name)
                        .filter(Boolean).join('、');
                      return `${m?.name}（${conflictPeople}）`;
                    }).join('、')} 已被排班但今日休假，請調整。
                  </span>
                </div>
              )}
            </div>

            {/* Alert bar */}
            {canEdit && alertRows.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-orange-800 font-medium text-sm mb-2">
                  <ClockAlert size={15} />
                  在崗過久警示（超過 {ALERT_DAYS} 天需考慮輪調）
                </div>
                <div className="flex flex-wrap gap-2">
                  {alertRows.map(r => {
                    const op = personMap.get(r.operatorId);
                    const m = machineMap.get(r.machineId);
                    return (
                      <div key={r.machineId} className="flex items-center gap-1.5 bg-white border border-orange-200 rounded-lg px-3 py-1.5 text-sm">
                        <span className="font-medium text-gray-700">{m?.name}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-orange-700 font-medium">{op?.name ?? r.operatorId}</span>
                        <span className="text-xs bg-red-100 text-red-600 border border-red-200 rounded px-1.5 py-0.5">{r.daysAtStation} 天</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Schedule table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              {rows.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <Factory size={36} className="mx-auto mb-3 text-gray-300" />
                  <p className="font-medium text-gray-600">尚未選擇任何機台</p>
                  <p className="text-sm mt-1">點擊上方「選擇機台」按鈕加入今日要使用的機台</p>
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left font-semibold text-gray-600 px-2 py-3 w-20">機台</th>
                      <th className="text-left font-semibold text-gray-600 px-2 py-3 w-24">主機</th>
                      <th className="text-left font-semibold text-gray-600 px-2 py-3 w-32">作業員</th>
                      <th className="text-left font-semibold text-gray-600 px-2 py-3">品項</th>
                      {canEdit && <th className="text-left font-semibold text-gray-600 px-2 py-3 w-20">在崗</th>}
                      {canEdit && <th className="px-4 py-3 w-20"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const isEditing = editingRowMachine === row.machineId;
                      const isAlert = row.daysAtStation >= ALERT_DAYS;
                      const op = personMap.get(row.operatorId);
                      const m = machineMap.get(row.machineId);
                      const opOnLeave = row.operatorId && leaveSet.has(row.operatorId);
                      const coOnLeave = row.collaboratorIds.some(id => leaveSet.has(id));
                      const hasConflict = opOnLeave || coOnLeave;
                      const availablePersonnel = personnel.filter(p => !leaveSet.has(p.id));

                      return (
                        <tr key={row.machineId}
                          className={`border-b border-gray-100 last:border-0 ${
                            isEditing ? 'bg-blue-50' :
                            hasConflict ? 'bg-rose-50/50' :
                            isAlert ? 'bg-orange-50/40' :
                            idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                          }`}>
                          <td className="px-2 py-3">
                            <span className="text-xs font-mono text-gray-400 block">{row.machineId}</span>
                            <span className="font-medium text-gray-800 text-sm">{m?.name}</span>
                          </td>

                          <td className="px-2 py-3">
                            {isEditing ? (
                              <select value={editingRowData.operatorId ?? ''}
                                onChange={e => setEditingRowData(p => ({ ...p, operatorId: e.target.value }))}
                                className="w-full border border-blue-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                                <option value="">— 未指派 —</option>
                                {availablePersonnel.map(p => (
                                  <option key={p.id} value={p.id}>{p.id} {p.name}</option>
                                ))}
                              </select>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                {row.operatorId ? (
                                  <>
                                    <span className="text-xs font-mono text-gray-400 bg-gray-100 rounded px-1">{row.operatorId}</span>
                                    <span className="font-medium text-gray-800">{op?.name ?? '—'}</span>
                                    {opOnLeave && <span className="text-xs text-rose-600 bg-rose-100 rounded px-1">休假</span>}
                                  </>
                                ) : (
                                  <span className="text-gray-300 text-sm italic">未指派</span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-2 py-3">
                            {isEditing ? (
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {availablePersonnel.map(p => {
                                  const editIds: string[] = (editingRowData.collaboratorIds as string[] | undefined) ?? [];
                                  const checked = editIds.includes(p.id);
                                  return (
                                    <label key={p.id} className="flex items-center gap-1.5 text-sm cursor-pointer hover:bg-blue-50 rounded px-1 py-0.5">
                                      <input type="checkbox" checked={checked}
                                        onChange={() => {
                                          setEditingRowData(prev => {
                                            const cur: string[] = (prev.collaboratorIds as string[] | undefined) ?? [];
                                            const next = checked ? cur.filter(x => x !== p.id) : [...cur, p.id];
                                            return { ...prev, collaboratorIds: next };
                                          });
                                        }}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-400" />
                                      <span className="text-xs font-mono text-gray-400">{p.id}</span>
                                      <span>{p.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {row.collaboratorIds.length > 0 ? row.collaboratorIds.map(cid => {
                                  const co = personMap.get(cid);
                                  const onLeave = leaveSet.has(cid);
                                  return (
                                    <span key={cid} className="inline-flex items-center gap-1 text-sm bg-gray-100 rounded px-1.5 py-0.5">
                                      <span className="text-xs font-mono text-gray-400">{cid}</span>
                                      <span className="text-gray-800">{co?.name ?? '—'}</span>
                                      {onLeave && <span className="text-xs text-rose-600 bg-rose-100 rounded px-1">休假</span>}
                                    </span>
                                  );
                                }) : (
                                  <span className="text-gray-300 text-sm">—</span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-2 py-3">
                            {isEditing ? (
                              <input value={editingRowData.productionItems ?? ''}
                                onChange={e => setEditingRowData(p => ({ ...p, productionItems: e.target.value }))}
                                placeholder="輸入品項"
                                className="w-full border border-blue-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            ) : (
                              <span className="text-gray-700">{row.productionItems || <span className="text-gray-300 italic">未填寫</span>}</span>
                            )}
                          </td>

                          {canEdit && (
                            <td className="px-2 py-3">
                              <div className="flex items-center gap-1">
                                <span className={`font-semibold text-sm ${isAlert ? 'text-red-600' : 'text-gray-700'}`}>{row.daysAtStation}天</span>
                                {isAlert && <AlertTriangle size={12} className="text-orange-500" />}
                              </div>
                            </td>
                          )}

                          {canEdit && (
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <div className="flex gap-1">
                                  <button onClick={saveEditRow} className="p-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                                    <Check size={13} />
                                  </button>
                                  <button onClick={() => { setEditingRowMachine(null); setEditingRowData({}); }} className="p-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100">
                                    <X size={13} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex gap-1">
                                  <button onClick={() => startEditRow(row)} className="p-1.5 text-gray-300 hover:text-blue-600 rounded-lg hover:bg-blue-50">
                                    <Edit3 size={13} />
                                  </button>
                                  {canDelete && (
                                    <button onClick={() => removeRow(row.machineId)} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50" title="移出今日排班（僅管理員）">
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ══ Personnel Tab ══ */}
        {!loading && tab === 'personnel' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                共 <span className="font-medium text-gray-700">{personnel.length}</span> 位人員　·
                <span className="font-medium text-gray-700">{machines.length}</span> 台機器
              </p>
              <button onClick={() => setEditingPersonnel('new')}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm">
                <Plus size={14} />新增人員
              </button>
            </div>

            <div className="space-y-2">
              {personnel.map(p => {
                const isExpanded = expandedPersonnel === p.id;
                const expertMachines = p.skills.filter(s => s.level === 'expert');
                const competentMachines = p.skills.filter(s => s.level === 'competent');
                const opAssignment = rows.find(r => r.operatorId === p.id);
                const coAssignment = rows.find(r => r.collaboratorIds.includes(p.id));
                const isOnLeave = leaveSet.has(p.id);

                return (
                  <div key={p.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isOnLeave ? 'border-rose-200' : 'border-gray-200'}`}>
                    <div className="flex items-center gap-4 px-4 py-3">
                      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm ${
                        isOnLeave ? 'bg-rose-100 text-rose-600' : 'bg-blue-600 text-white'
                      }`}>{p.name.charAt(0)}</div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-gray-400 bg-gray-100 rounded px-1">{p.id}</span>
                          <span className="font-semibold text-gray-800">{p.name}</span>
                          {isOnLeave && (
                            <span className="text-xs bg-rose-100 text-rose-600 border border-rose-200 rounded-full px-2 py-0.5">今日休假</span>
                          )}
                          {opAssignment && (() => {
                            const m = machineMap.get(opAssignment.machineId);
                            return (
                              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
                                操作：{m?.name}
                                {opAssignment.daysAtStation >= ALERT_DAYS && (
                                  <span className="ml-1 text-orange-500">⚠ {opAssignment.daysAtStation}天</span>
                                )}
                              </span>
                            );
                          })()}
                          {coAssignment && !opAssignment && (() => {
                            const m = machineMap.get(coAssignment.machineId);
                            return (
                              <span className="text-xs bg-gray-50 text-gray-600 border border-gray-200 rounded-full px-2 py-0.5">
                                協作：{m?.name}
                              </span>
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span>
                            熟練（{expertMachines.length}）：
                            {expertMachines.length > 0
                              ? expertMachines.slice(0, 4).map(s => machineMap.get(s.machineId)?.name).join('、') +
                                (expertMachines.length > 4 ? `…+${expertMachines.length - 4}` : '')
                              : <span className="text-gray-300">無</span>
                            }
                          </span>
                          <span className="text-gray-200">|</span>
                          <span>會（{competentMachines.length}）</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditingPersonnel(p)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50">
                          <Edit3 size={14} />
                        </button>
                        {canDelete && (
                          <button onClick={async () => {
                            if (!confirm(`確定刪除 ${p.name}？`)) return;
                            await api.deletePersonnel(p.id);
                            await refreshPersonnel();
                          }} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                            <Trash2 size={14} />
                          </button>
                        )}
                        <button onClick={() => setExpandedPersonnel(isExpanded ? null : p.id)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 pb-4 pt-3 bg-gray-50/50">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">機台技能詳細（{machines.length} 台）</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {machines.map(m => {
                            const skill = p.skills.find(s => s.machineId === m.id);
                            const level = skill?.level ?? 'none';
                            return (
                              <div key={m.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
                                <div className="min-w-0 flex-1">
                                  <span className="text-xs text-gray-400 font-mono block">{m.id}</span>
                                  <span className="text-sm text-gray-700 truncate block">{m.name}</span>
                                </div>
                                <SkillBadge level={level} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ Machine Tab ══ */}
        {!loading && tab === 'machine' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                共 <span className="font-medium text-gray-700">{machines.length}</span> 台機台
              </p>
              <button onClick={() => setEditingMachine('new')}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm">
                <Plus size={14} />新增機台
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left font-semibold text-gray-600 px-4 py-3 w-32">機台號碼</th>
                    <th className="text-left font-semibold text-gray-600 px-4 py-3">機台名稱</th>
                    <th className="text-left font-semibold text-gray-600 px-4 py-3 w-40">熟練人員</th>
                    <th className="text-left font-semibold text-gray-600 px-4 py-3 w-32">今日狀態</th>
                    <th className="px-4 py-3 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {machines.map((m, idx) => {
                    const expertCount = personnel.filter(p =>
                      p.skills.find(s => s.machineId === m.id)?.level === 'expert'
                    ).length;
                    const competentCount = personnel.filter(p =>
                      p.skills.find(s => s.machineId === m.id)?.level === 'competent'
                    ).length;
                    const inSchedule = rows.find(r => r.machineId === m.id);
                    const op = inSchedule ? personMap.get(inSchedule.operatorId) : null;

                    return (
                      <tr key={m.id} className={`border-b border-gray-100 last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-gray-700 bg-gray-100 rounded px-2 py-0.5">{m.id}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-800">{m.name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">熟練 {expertCount}</span>
                            <span className="text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">會 {competentCount}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {inSchedule ? (
                            <div className="text-xs">
                              <span className="text-blue-700 font-medium">運轉中</span>
                              <div className="text-gray-500 mt-0.5">{op?.name ?? '未指派'}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">未排班</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => setEditingMachine(m)} className="p-1.5 text-gray-300 hover:text-blue-600 rounded-lg hover:bg-blue-50">
                              <Edit3 size={13} />
                            </button>
                            {canDelete && (
                              <button onClick={() => handleDeleteMachine(m.id)} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ Overtime Tab ══ */}
        {!loading && tab === 'overtime' && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-500">加班日期</label>
                <input type="date" value={scheduleDate}
                  onChange={e => { userPickedDateRef.current = true; setScheduleDate(e.target.value); }}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                {canEdit && (
                  <button onClick={() => setShowOtMachinePicker(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 bg-white text-sm text-gray-700 rounded-lg hover:bg-gray-50">
                    <Factory size={14} />選擇機台
                    <span className="bg-blue-100 text-blue-700 text-xs rounded-full px-2 py-0.5 ml-1">{overtimeRows.length}</span>
                  </button>
                )}
              </div>
              {canEdit && (
                <button onClick={async () => {
                  if (overtimeRows.length > 0 && !confirm('將清除目前加班排班並從每日排班複製，確定？')) return;
                  await api.copyScheduleToOvertime(scheduleDate);
                  await refreshOvertime(scheduleDate);
                }}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 shadow-sm">
                  <Copy size={15} />一鍵複製每日排班
                </button>
              )}
            </div>

            {!canEdit && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800 flex items-center gap-2">
                <Eye size={14} />
                <span>您目前以瀏覽模式查看排班，僅能檢視內容。如需編輯請點右上角「登入」。</span>
              </div>
            )}

            {/* Overtime table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              {overtimeRows.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <Clock size={36} className="mx-auto mb-3 text-gray-300" />
                  <p className="font-medium text-gray-600">尚未安排加班</p>
                  <p className="text-sm mt-1">點擊「一鍵複製每日排班」快速匯入，或手動選擇機台</p>
                </div>
              ) : (
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-amber-50 border-b border-amber-200">
                      <th className="text-left font-semibold text-gray-600 px-2 py-3 w-20">機台</th>
                      <th className="text-left font-semibold text-gray-600 px-2 py-3 w-24">主機</th>
                      <th className="text-left font-semibold text-gray-600 px-2 py-3 w-32">作業員</th>
                      <th className="text-left font-semibold text-gray-600 px-2 py-3">品項</th>
                      {canEdit && <th className="px-4 py-3 w-20"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {overtimeRows.map((row, idx) => {
                      const isEditing = editingOtMachine === row.machineId;
                      const op = personMap.get(row.operatorId);
                      const m = machineMap.get(row.machineId);

                      return (
                        <tr key={row.machineId}
                          className={`border-b border-gray-100 last:border-0 ${
                            isEditing ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                          }`}>
                          <td className="px-2 py-3">
                            <span className="text-xs font-mono text-gray-400 block">{row.machineId}</span>
                            <span className="font-medium text-gray-800 text-sm">{m?.name}</span>
                          </td>

                          <td className="px-2 py-3">
                            {isEditing ? (
                              <select value={editingOtData.operatorId ?? ''}
                                onChange={e => setEditingOtData(p => ({ ...p, operatorId: e.target.value }))}
                                className="w-full border border-blue-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white">
                                <option value="">— 未指派 —</option>
                                {personnel.map(p => (
                                  <option key={p.id} value={p.id}>{p.id} {p.name}</option>
                                ))}
                              </select>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                {row.operatorId ? (
                                  <>
                                    <span className="text-xs font-mono text-gray-400 bg-gray-100 rounded px-1">{row.operatorId}</span>
                                    <span className="font-medium text-gray-800">{op?.name ?? '—'}</span>
                                  </>
                                ) : (
                                  <span className="text-gray-300 text-sm italic">未指派</span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-2 py-3">
                            {isEditing ? (
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {personnel.map(p => {
                                  const editIds: string[] = (editingOtData.collaboratorIds as string[] | undefined) ?? [];
                                  const checked = editIds.includes(p.id);
                                  return (
                                    <label key={p.id} className="flex items-center gap-1.5 text-sm cursor-pointer hover:bg-blue-50 rounded px-1 py-0.5">
                                      <input type="checkbox" checked={checked}
                                        onChange={() => {
                                          setEditingOtData(prev => {
                                            const cur: string[] = (prev.collaboratorIds as string[] | undefined) ?? [];
                                            const next = checked ? cur.filter(x => x !== p.id) : [...cur, p.id];
                                            return { ...prev, collaboratorIds: next };
                                          });
                                        }}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-400" />
                                      <span className="text-xs font-mono text-gray-400">{p.id}</span>
                                      <span>{p.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {row.collaboratorIds.length > 0 ? row.collaboratorIds.map(cid => {
                                  const co = personMap.get(cid);
                                  return (
                                    <span key={cid} className="inline-flex items-center gap-1 text-sm bg-gray-100 rounded px-1.5 py-0.5">
                                      <span className="text-xs font-mono text-gray-400">{cid}</span>
                                      <span className="text-gray-800">{co?.name ?? '—'}</span>
                                    </span>
                                  );
                                }) : (
                                  <span className="text-gray-300 text-sm">—</span>
                                )}
                              </div>
                            )}
                          </td>

                          <td className="px-2 py-3">
                            {isEditing ? (
                              <input value={editingOtData.productionItems ?? ''}
                                onChange={e => setEditingOtData(p => ({ ...p, productionItems: e.target.value }))}
                                placeholder="輸入品項"
                                className="w-full border border-blue-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            ) : (
                              <span className="text-gray-700">{row.productionItems || <span className="text-gray-300 italic">未填寫</span>}</span>
                            )}
                          </td>

                          {canEdit && (
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <div className="flex gap-1">
                                  <button onClick={async () => {
                                    if (!editingOtMachine) return;
                                    const original = overtimeRows.find(r => r.machineId === editingOtMachine);
                                    if (!original) return;
                                    const merged = { ...original, ...editingOtData };
                                    await api.saveOvertimeRow({
                                      date: scheduleDate,
                                      machineId: merged.machineId,
                                      operatorId: merged.operatorId,
                                      collaboratorIds: merged.collaboratorIds,
                                      productionItems: merged.productionItems,
                                    });
                                    setEditingOtMachine(null);
                                    setEditingOtData({});
                                    await refreshOvertime(scheduleDate);
                                  }} className="p-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                                    <Check size={13} />
                                  </button>
                                  <button onClick={() => { setEditingOtMachine(null); setEditingOtData({}); }} className="p-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100">
                                    <X size={13} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex gap-1">
                                  <button onClick={() => { setEditingOtMachine(row.machineId); setEditingOtData({ ...row }); }} className="p-1.5 text-gray-300 hover:text-blue-600 rounded-lg hover:bg-blue-50">
                                    <Edit3 size={13} />
                                  </button>
                                  {canDelete && (
                                    <button onClick={async () => {
                                      await api.deleteOvertimeRow(scheduleDate, row.machineId);
                                      await refreshOvertime(scheduleDate);
                                    }} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50">
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {editingPersonnel !== null && (
        <PersonnelModal
          person={editingPersonnel === 'new' ? null : editingPersonnel}
          machines={machines}
          onSave={handleSavePersonnel}
          onClose={() => setEditingPersonnel(null)}
        />
      )}

      {editingMachine !== null && (
        <MachineModal
          machine={editingMachine === 'new' ? null : editingMachine}
          existingIds={machines.map(m => m.id)}
          onSave={handleSaveMachine}
          onClose={() => setEditingMachine(null)}
        />
      )}

      {showMachinePicker && (
        <MachinePickerModal
          machines={machines}
          currentMachineIds={rows.map(r => r.machineId)}
          onConfirm={handleMachinePickerConfirm}
          onClose={() => setShowMachinePicker(false)}
        />
      )}

      {showOtMachinePicker && (
        <MachinePickerModal
          machines={machines}
          currentMachineIds={overtimeRows.map(r => r.machineId)}
          onConfirm={async (selected) => {
            const bulkRows = selected.map(id => {
              const existing = overtimeRows.find(r => r.machineId === id);
              if (existing) {
                return {
                  machineId: id,
                  operatorId: existing.operatorId || undefined,
                  collaboratorIds: existing.collaboratorIds.length > 0 ? existing.collaboratorIds : undefined,
                  productionItems: existing.productionItems || undefined,
                };
              }
              return { machineId: id };
            });
            await api.bulkSaveOvertime(scheduleDate, bulkRows);
            setShowOtMachinePicker(false);
            await refreshOvertime(scheduleDate);
          }}
          onClose={() => setShowOtMachinePicker(false)}
        />
      )}

      {showLeavePicker && (
        <LeavePickerModal
          personnel={personnel}
          currentLeaveIds={leaveIds}
          onConfirm={async (ids) => {
            await api.saveLeave(scheduleDate, ids);
            setLeaveIds(ids);
            setShowLeavePicker(false);
          }}
          onClose={() => setShowLeavePicker(false)}
        />
      )}

      {showAI && (
        <AISuggestionPanel
          suggestions={aiSuggestions}
          onApply={handleApplySuggestion}
          onClose={() => setShowAI(false)}
        />
      )}

      {showLogin && (
        <LoginModal
          onLogin={handleLogin}
          onClose={() => setShowLogin(false)}
        />
      )}

    </div>
  );
}
