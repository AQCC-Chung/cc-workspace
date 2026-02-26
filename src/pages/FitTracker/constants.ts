
import { Exercise, WorkoutCategory } from './types';

export const INITIAL_EXERCISES: Exercise[] = [
  // ─── 胸部 ───
  { id: '1', name: '機械胸部推舉', category: 'Chest', usageCount: 0 },
  { id: '2', name: '上斜啞鈴臥推', category: 'Chest', usageCount: 0 },
  { id: '3', name: '機械蝴蝶機夾胸', category: 'Chest', usageCount: 0 },
  { id: '4', name: '雙槓支撐', category: 'Chest', usageCount: 0 },
  { id: '5', name: '槓鈴臥推', category: 'Chest', usageCount: 0 },
  { id: '6', name: '伏地挺身', category: 'Chest', usageCount: 0 },
  { id: '7', name: '滑輪擴胸', category: 'Chest', usageCount: 0 },
  { id: '8', name: '下斜槓鈴臥推', category: 'Chest', usageCount: 0 },
  { id: '9', name: '啞鈴飛鳥', category: 'Chest', usageCount: 0 },
  { id: '10', name: '窄距臥推', category: 'Chest', usageCount: 0 },

  // ─── 背部 ───
  { id: '11', name: '坐姿划船', category: 'Back', usageCount: 0 },
  { id: '12', name: '滑輪下拉', category: 'Back', usageCount: 0 },
  { id: '13', name: 'S9PO背肌訓練機', category: 'Back', usageCount: 0 },
  { id: '14', name: '引體向上', category: 'Back', usageCount: 0 },
  { id: '15', name: '蝴蝶機', category: 'Back', usageCount: 0 },
  { id: '16', name: '槓鈴划船', category: 'Back', usageCount: 0 },
  { id: '17', name: '單臂啞鈴划船', category: 'Back', usageCount: 0 },
  { id: '18', name: '硬舉', category: 'Back', usageCount: 0 },
  { id: '19', name: 'T桿划船', category: 'Back', usageCount: 0 },
  { id: '20', name: '直臂下拉', category: 'Back', usageCount: 0 },

  // ─── 肩部 ───
  { id: '21', name: '肩上推舉', category: 'Shoulder', usageCount: 0 },
  { id: '22', name: '肩側訓練機', category: 'Shoulder', usageCount: 0 },
  { id: '23', name: '側平舉', category: 'Shoulder', usageCount: 0 },
  { id: '24', name: '啞鈴前平舉', category: 'Shoulder', usageCount: 0 },
  { id: '25', name: '阿諾推舉', category: 'Shoulder', usageCount: 0 },
  { id: '26', name: '反向飛鳥', category: 'Shoulder', usageCount: 0 },
  { id: '27', name: '直立划船', category: 'Shoulder', usageCount: 0 },
  { id: '28', name: '臉拉 (Face Pull)', category: 'Shoulder', usageCount: 0 },
  { id: '29', name: '六角槓聳肩', category: 'Shoulder', usageCount: 0 },
  { id: '30', name: '機械側平舉', category: 'Shoulder', usageCount: 0 },

  // ─── 腿部 ───
  { id: '31', name: '坐姿深蹲機', category: 'Legs', usageCount: 0 },
  { id: '32', name: '坐姿股四頭', category: 'Legs', usageCount: 0 },
  { id: '33', name: '坐姿分腿機', category: 'Legs', usageCount: 0 },
  { id: '34', name: '坐姿屈腿機', category: 'Legs', usageCount: 0 },
  { id: '35', name: '坐姿夾腿機', category: 'Legs', usageCount: 0 },
  { id: '36', name: '深蹲', category: 'Legs', usageCount: 0 },
  { id: '37', name: '腿部推舉', category: 'Legs', usageCount: 0 },
  { id: '38', name: '分腿蹲', category: 'Legs', usageCount: 0 },
  { id: '39', name: '腿部捲曲', category: 'Legs', usageCount: 0 },
  { id: '40', name: '槓鈴臀推', category: 'Legs', usageCount: 0 },

  // ─── 手臂 ───
  { id: '41', name: '二頭肌彎舉', category: 'Arms', usageCount: 0 },
  { id: '42', name: '三頭肌伸展', category: 'Arms', usageCount: 0 },
  { id: '43', name: '錘式彎舉', category: 'Arms', usageCount: 0 },
  { id: '44', name: '窄距伏地挺身', category: 'Arms', usageCount: 0 },
  { id: '45', name: '牧師凳彎舉', category: 'Arms', usageCount: 0 },
  { id: '46', name: '法式推舉', category: 'Arms', usageCount: 0 },
  { id: '47', name: '滑輪三頭下壓', category: 'Arms', usageCount: 0 },
  { id: '48', name: '斜板彎舉', category: 'Arms', usageCount: 0 },
  { id: '49', name: '啞鈴頸後臂屈伸', category: 'Arms', usageCount: 0 },
  { id: '50', name: '集中彎舉', category: 'Arms', usageCount: 0 },
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

// Smart Coach — 進階增量
export const INCREMENT_BARBELL = 5;
export const INCREMENT_DUMBBELL = 2.5;
export const INCREMENT_MACHINE = 2.5;
