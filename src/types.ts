export type SkillLevel = 'expert' | 'competent' | 'learning' | 'none';

export interface MachineSkill {
  machineId: string;
  level: SkillLevel;
}

export interface Personnel {
  id: string;
  name: string;
  skills: MachineSkill[];
}

export interface ScheduleRow {
  machineId: string;
  operatorId: string;
  collaboratorId: string;
  productionItems: string;
  daysAtStation: number;
  assignedDate: string;
}

export interface ScheduleDay {
  date: string;
  leaveIds: string[]; // personnel on leave today
  rows: ScheduleRow[];
}

export interface Machine {
  id: string;
  name: string;
}

export type TabType = 'schedule' | 'personnel' | 'machine';

export type Role = 'viewer' | 'scheduler' | 'admin';

export interface User {
  username: string;
  role: Role;
  displayName: string;
}
