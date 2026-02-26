import type { Exercise, WeightWorkoutSession, EquipmentType } from './types';
import { INCREMENT_BARBELL, INCREMENT_DUMBBELL, INCREMENT_MACHINE } from './constants';

// ─── Types ───────────────────────────────────────────────────

export type WeekType = 'W1' | 'W2' | 'W3' | 'W4';

export interface CycleRecommendation {
    cycleNumber: number;
    weekType: WeekType;
    weekLabel: string;
    targetWeight: number;
    targetRepsMin: number;
    targetRepsMax: number;
    targetSets: number;
    shouldProgress: boolean;
    progressInfo?: string;
    lastW1?: { weight: number; reps: number; date: string };
}

// ─── Config ──────────────────────────────────────────────────

const WEEK_CONFIG: Record<WeekType, {
    label: string;
    multiplier: number;
    repsMin: number;
    repsMax: number;
    sets: number;
}> = {
    W1: { label: '神經適應', multiplier: 1.0, repsMin: 4, repsMax: 6, sets: 4 },
    W2: { label: '肌肥大', multiplier: 0.8, repsMin: 10, repsMax: 12, sets: 4 },
    W3: { label: '耐力週', multiplier: 0.75, repsMin: 15, repsMax: 15, sets: 3 },
    W4: { label: '減量週', multiplier: 0.5, repsMin: 10, repsMax: 10, sets: 2 },
};

const WEEK_ORDER: WeekType[] = ['W1', 'W2', 'W3', 'W4'];

// ─── Helpers ─────────────────────────────────────────────────

export function getIncrement(type?: EquipmentType): number {
    switch (type) {
        case 'barbell': return INCREMENT_BARBELL;
        case 'dumbbell': return INCREMENT_DUMBBELL;
        case 'machine': return INCREMENT_MACHINE;
        default: return INCREMENT_DUMBBELL;
    }
}

/**
 * 取得某動作的所有歷史 session，按日期排序（舊→新）
 * 每個日期只算一次（同一天多次訓練視為同一個 session）
 */
function getExerciseHistory(exerciseId: string, sessions: WeightWorkoutSession[]) {
    const filtered = sessions
        .filter(s => s.exerciseId === exerciseId && s.sets.length > 0)
        .sort((a, b) => a.date.localeCompare(b.date));

    // 每個日期只保留一個（去重）
    const seen = new Set<string>();
    return filtered.filter(s => {
        if (seen.has(s.date)) return false;
        seen.add(s.date);
        return true;
    });
}

/**
 * 從歷史推算目前在第幾個循環的第幾週
 * 邏輯：cycleStartDate 之後每 4 個不同日期的 session 為一個 cycle
 */
function getCurrentWeekIndex(
    exercise: Exercise,
    sessions: WeightWorkoutSession[]
): number {
    const history = getExerciseHistory(exercise.id, sessions);

    if (!exercise.cycleStartDate || history.length === 0) {
        return 0; // W1
    }

    // 只算 cycleStartDate 之後的 session
    const relevantSessions = history.filter(s => s.date >= exercise.cycleStartDate!);
    return relevantSessions.length % 4;
}

// ─── Main API ────────────────────────────────────────────────

export function getRecommendation(
    exercise: Exercise,
    sessions: WeightWorkoutSession[]
): CycleRecommendation | null {
    if (!exercise.baseWeight) return null;

    const history = getExerciseHistory(exercise.id, sessions);
    const weekIndex = getCurrentWeekIndex(exercise, sessions);
    const weekType = WEEK_ORDER[weekIndex];
    const config = WEEK_CONFIG[weekType];

    // 計算循環編號
    const relevantSessions = exercise.cycleStartDate
        ? history.filter(s => s.date >= exercise.cycleStartDate!)
        : history;
    const cycleNumber = Math.floor(relevantSessions.length / 4) + 1;

    // 計算基準重量（考慮進階）
    let baseWeight = exercise.baseWeight;

    // 檢查上一個完整循環的 W1 表現來判斷是否進階
    const lastW1Session = findLastW1Session(exercise, sessions);
    let shouldProgress = false;
    let progressInfo: string | undefined;

    if (lastW1Session) {
        const maxReps = Math.max(...lastW1Session.sets.map(s => s.reps));
        if (maxReps >= 8) {
            const increment = getIncrement(exercise.equipmentType);
            shouldProgress = true;
            progressInfo = `上次 W1 做到 ${maxReps} 下 (≥8)，基準重量 +${increment}kg`;
            // 只在新循環的 W1 時自動加重
            if (weekIndex === 0) {
                baseWeight += increment;
            }
        }
    }

    const targetWeight = Math.round(baseWeight * config.multiplier * 10) / 10;

    return {
        cycleNumber,
        weekType,
        weekLabel: config.label,
        targetWeight,
        targetRepsMin: config.repsMin,
        targetRepsMax: config.repsMax,
        targetSets: config.sets,
        shouldProgress,
        progressInfo,
        lastW1: lastW1Session
            ? {
                weight: lastW1Session.sets[0].weight,
                reps: Math.max(...lastW1Session.sets.map(s => s.reps)),
                date: lastW1Session.date,
            }
            : undefined,
    };
}

/**
 * 找到最近一次 W1 training session
 * W1 是每 4 次 session 中的第 0 次
 */
function findLastW1Session(
    exercise: Exercise,
    sessions: WeightWorkoutSession[]
): WeightWorkoutSession | null {
    const history = getExerciseHistory(exercise.id, sessions);
    if (history.length === 0) return null;

    const startDate = exercise.cycleStartDate || history[0].date;
    const relevant = history.filter(s => s.date >= startDate);

    // 找最後一個 W1 位置（index % 4 === 0 的 session）
    for (let i = relevant.length - 1; i >= 0; i--) {
        if (i % 4 === 0) return relevant[i];
    }
    return null;
}

/**
 * 取得進度概要字串（給 UI 顯示）
 */
export function getProgressSummary(rec: CycleRecommendation): string {
    const reps = rec.targetRepsMin === rec.targetRepsMax
        ? `${rec.targetRepsMin} 下`
        : `${rec.targetRepsMin}-${rec.targetRepsMax} 下`;
    return `${rec.targetWeight}kg × ${reps} × ${rec.targetSets} 組`;
}
