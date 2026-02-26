
export type Unit = 'KG' | 'LBS';

export type EquipmentType = 'barbell' | 'dumbbell' | 'machine';

export interface UserBodyData {
  weight: number;
  height: number;
  age: number;
}

export type WorkoutCategory = 'Chest' | 'Back' | 'Shoulder' | 'Legs' | 'Arms' | 'Custom';

export interface Exercise {
  id: string;
  name: string;
  category: WorkoutCategory;
  usageCount: number;
  equipmentType?: EquipmentType;
  baseWeight?: number;
  cycleStartDate?: string;
}

export interface SetRecord {
  weight: number; // Stored in KG
  reps: number;
  timestamp: number;
  rpe?: number; // 主觀疲勞度 1-10
}

export interface WeightWorkoutSession {
  id: string;
  date: string; // YYYY-MM-DD
  exerciseId: string;
  sets: SetRecord[];
}

export interface CardioRecord {
  id: string;
  date: string;
  machine: string;
  duration: number; // Minutes
  distance?: number;
  kcal?: number;
  heartRate?: number;
  speed?: number;
  incline?: number;
}

export interface DailySummary {
  totalKcal: number;
  trainingTimeSeconds: number; // From first set to last set
}

export type ViewType = 'WEIGHT' | 'CARDIO' | 'CALENDAR';
