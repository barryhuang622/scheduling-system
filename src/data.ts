import type { Machine, Personnel, ScheduleDay } from './types';

export const MACHINES: Machine[] = [
  { id: 'M01', name: 'CNC車床A' },
  { id: 'M02', name: 'CNC車床B' },
  { id: 'M03', name: 'CNC車床C' },
  { id: 'M04', name: '銑床A' },
  { id: 'M05', name: '銑床B' },
  { id: 'M06', name: '銑床C' },
  { id: 'M07', name: '鑽床A' },
  { id: 'M08', name: '鑽床B' },
  { id: 'M09', name: '研磨機A' },
  { id: 'M10', name: '研磨機B' },
  { id: 'M11', name: '衝壓機A' },
  { id: 'M12', name: '衝壓機B' },
  { id: 'M13', name: '衝壓機C' },
  { id: 'M14', name: '焊接站A' },
  { id: 'M15', name: '焊接站B' },
  { id: 'M16', name: '雷射切割A' },
  { id: 'M17', name: '雷射切割B' },
  { id: 'M18', name: '折床' },
  { id: 'M19', name: '剪床' },
  { id: 'M20', name: '線切割' },
  { id: 'M21', name: '放電加工' },
  { id: 'M22', name: '滾齒機' },
  { id: 'M23', name: '搪床' },
  { id: 'M24', name: '臥式加工中心' },
  { id: 'M25', name: '立式加工中心' },
  { id: 'M26', name: '熱處理爐' },
  { id: 'M27', name: '噴漆線' },
  { id: 'M28', name: '組裝線A' },
  { id: 'M29', name: '組裝線B' },
  { id: 'M30', name: '品檢台' },
];

// Helper: assign random skill levels for the rest of machines
function fillSkills(known: Record<string, 'expert' | 'competent' | 'learning' | 'none'>) {
  return MACHINES.map(m => ({
    machineId: m.id,
    level: known[m.id] ?? 'none' as const,
  }));
}

export const INITIAL_PERSONNEL: Personnel[] = [
  {
    id: 'P001', name: '王大明',
    skills: fillSkills({
      M01: 'expert', M02: 'expert', M03: 'competent', M04: 'competent',
      M07: 'learning', M24: 'expert', M25: 'competent', M30: 'competent',
    }),
  },
  {
    id: 'P002', name: '李小花',
    skills: fillSkills({
      M01: 'competent', M04: 'expert', M05: 'expert', M06: 'competent',
      M07: 'expert', M08: 'expert', M09: 'competent', M30: 'learning',
    }),
  },
  {
    id: 'P003', name: '陳建國',
    skills: fillSkills({
      M09: 'expert', M10: 'expert', M11: 'expert', M12: 'expert',
      M13: 'competent', M14: 'competent', M18: 'learning',
    }),
  },
  {
    id: 'P004', name: '張美玲',
    skills: fillSkills({
      M14: 'expert', M15: 'expert', M16: 'competent', M17: 'competent',
      M27: 'expert', M28: 'competent', M29: 'competent', M30: 'expert',
    }),
  },
  {
    id: 'P005', name: '林志豪',
    skills: fillSkills({
      M01: 'expert', M02: 'competent', M03: 'competent', M07: 'expert',
      M08: 'expert', M20: 'competent', M21: 'competent', M24: 'learning',
    }),
  },
  {
    id: 'P006', name: '黃秀英',
    skills: fillSkills({
      M02: 'expert', M04: 'competent', M05: 'expert', M06: 'expert',
      M11: 'competent', M12: 'expert', M16: 'expert', M17: 'competent',
    }),
  },
  {
    id: 'P007', name: '吳俊傑',
    skills: fillSkills({
      M16: 'expert', M17: 'expert', M18: 'expert', M19: 'expert',
      M20: 'competent', M21: 'competent',
    }),
  },
  {
    id: 'P008', name: '蔡淑芬',
    skills: fillSkills({
      M22: 'expert', M23: 'expert', M24: 'competent', M25: 'expert',
      M26: 'competent', M30: 'expert',
    }),
  },
  {
    id: 'P009', name: '周育成',
    skills: fillSkills({
      M26: 'expert', M27: 'expert', M28: 'expert', M29: 'expert',
      M14: 'competent', M15: 'competent',
    }),
  },
  {
    id: 'P010', name: '楊雅婷',
    skills: fillSkills({
      M03: 'expert', M06: 'expert', M10: 'competent', M13: 'expert',
      M19: 'competent', M22: 'learning', M30: 'competent',
    }),
  },
];

const today = new Date().toISOString().split('T')[0];
const ago35 = new Date(Date.now() - 35 * 86400000).toISOString().split('T')[0];
const ago20 = new Date(Date.now() - 20 * 86400000).toISOString().split('T')[0];
const ago10 = new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0];

export const INITIAL_SCHEDULE: ScheduleDay = {
  date: today,
  leaveIds: ['P007'],
  rows: [
    { machineId: 'M01', operatorId: 'P001', collaboratorId: 'P005', productionItems: '軸心零件 #A-2301', daysAtStation: 35, assignedDate: ago35 },
    { machineId: 'M02', operatorId: 'P006', collaboratorId: 'P002', productionItems: '齒輪組 #G-0812', daysAtStation: 20, assignedDate: ago20 },
    { machineId: 'M04', operatorId: 'P002', collaboratorId: 'P006', productionItems: '底座面加工 #B-1105', daysAtStation: 10, assignedDate: ago10 },
    { machineId: 'M07', operatorId: 'P005', collaboratorId: 'P002', productionItems: '孔位加工 #D-0302', daysAtStation: 22, assignedDate: ago20 },
    { machineId: 'M09', operatorId: 'P003', collaboratorId: 'P008', productionItems: '精磨表面 #S-4401', daysAtStation: 38, assignedDate: ago35 },
    { machineId: 'M11', operatorId: 'P003', collaboratorId: 'P006', productionItems: '鈑金衝壓 #P-2207', daysAtStation: 8, assignedDate: ago10 },
    { machineId: 'M14', operatorId: 'P004', collaboratorId: 'P009', productionItems: '框架焊接 #W-0501', daysAtStation: 45, assignedDate: ago35 },
    { machineId: 'M24', operatorId: 'P008', collaboratorId: 'P001', productionItems: 'CNC加工 #C-1102', daysAtStation: 12, assignedDate: ago10 },
    { machineId: 'M27', operatorId: 'P009', collaboratorId: 'P004', productionItems: '成品噴漆 #PT-3301', daysAtStation: 18, assignedDate: ago20 },
    { machineId: 'M30', operatorId: 'P010', collaboratorId: 'P004', productionItems: '成品檢驗 #Q-9901', daysAtStation: 5, assignedDate: ago10 },
  ],
};
