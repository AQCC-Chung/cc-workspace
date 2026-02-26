
import { Exercise, WorkoutCategory } from './types';

export const INITIAL_EXERCISES: Exercise[] = [
  { id: '1', name: '槓鈴臥推', category: 'Chest', usageCount: 0 },
  { id: '2', name: '上斜啞鈴臥推', category: 'Chest', usageCount: 0 },
  { id: '3', name: '滑輪擴胸', category: 'Chest', usageCount: 0 },
  { id: '4', name: '引體向上', category: 'Back', usageCount: 0 },
  { id: '5', name: '槓鈴划船', category: 'Back', usageCount: 0 },
  { id: '6', name: '滑輪下拉', category: 'Back', usageCount: 0 },
  { id: '7', name: '肩上推舉', category: 'Shoulder', usageCount: 0 },
  { id: '8', name: '側平舉', category: 'Shoulder', usageCount: 0 },
  { id: '9', name: '深蹲', category: 'Legs', usageCount: 0 },
  { id: '10', name: '腿部推舉', category: 'Legs', usageCount: 0 },
  { id: '11', name: '二頭肌彎舉', category: 'Arms', usageCount: 0 },
  { id: '12', name: '三頭肌伸展', category: 'Arms', usageCount: 0 },
];

export const CATEGORIES_CN: Record<string, string> = {
  'Chest': '胸部',
  'Back': '背部',
  'Shoulder': '肩部',
  'Legs': '腿部',
  'Arms': '手臂',
  'Custom': '自定義'
};

export const CATEGORIES: WorkoutCategory[] = ['Chest', 'Back', 'Shoulder', 'Legs', 'Arms', 'Custom'];

export const CARDIO_EQUIPMENT = [
  { name: '跑步機', met: 9.8 },
  { name: '飛輪', met: 8.5 },
  { name: '健身車', met: 7.5 },
  { name: '階梯機', met: 9.0 },
  { name: '划船機', met: 7.0 },
  { name: '橢圓機', met: 5.0 }
];

export const KG_TO_LBS = 2.20462;
export const REST_TIME_SECONDS = 90;
