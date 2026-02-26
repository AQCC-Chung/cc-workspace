import type { Exercise, WeightWorkoutSession, EquipmentType } from './types';
import { INCREMENT_BARBELL, INCREMENT_DUMBBELL, INCREMENT_MACHINE } from './constants';

// ─── Types ───────────────────────────────────────────────────

export type WeekType = 'W1' | 'W2' | 'W3';

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
    lastW2?: { weight: number; reps: number; date: string };
}

// ─── Config: Plan B 三週循環 ─────────────────────────────────

const WEEK_CONFIG: Record<WeekType, {
    label: string;
    multiplier: number;
    repsMin: number;
    repsMax: number;
    sets: number;
}> = {
    W1: { label: '肌肥大', multiplier: 0.75, repsMin: 8, repsMax: 12, sets: 4 },
    W2: { label: '力量週', multiplier: 1.0, repsMin: 4, repsMax: 6, sets: 4 },
    W3: { label: '減量週', multiplier: 0.50, repsMin: 8, repsMax: 10, sets: 2 },
};

const CYCLE_LENGTH = 3;
const WEEK_ORDER: WeekType[] = ['W1', 'W2', 'W3'];

// ─── Helpers ─────────────────────────────────────────────────

export function getIncrement(type?: EquipmentType): number {
    switch (type) {
        case 'barbell': return INCREMENT_BARBELL;
        case 'dumbbell': return INCREMENT_DUMBBELL;
        case 'machine': return INCREMENT_MACHINE;
        default: return INCREMENT_DUMBBELL;
    }
}

/** 取得某動作的歷史 session，按日期排序（舊→新），每日去重 */
function getExerciseHistory(exerciseId: string, sessions: WeightWorkoutSession[]) {
    const filtered = sessions
        .filter(s => s.exerciseId === exerciseId && s.sets.length > 0)
        .sort((a, b) => a.date.localeCompare(b.date));

    const seen = new Set<string>();
    return filtered.filter(s => {
        if (seen.has(s.date)) return false;
        seen.add(s.date);
        return true;
    });
}

function getCurrentWeekIndex(exercise: Exercise, sessions: WeightWorkoutSession[]): number {
    const history = getExerciseHistory(exercise.id, sessions);
    if (!exercise.cycleStartDate || history.length === 0) return 0;
    const relevant = history.filter(s => s.date >= exercise.cycleStartDate!);
    return relevant.length % CYCLE_LENGTH;
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

    const relevantSessions = exercise.cycleStartDate
        ? history.filter(s => s.date >= exercise.cycleStartDate!)
        : history;
    const cycleNumber = Math.floor(relevantSessions.length / CYCLE_LENGTH) + 1;

    let baseWeight = exercise.baseWeight;

    // 進階判斷：找最近 W2（力量週），max reps ≥ 6 時加重
    const lastW2Session = findLastWeekSession(exercise, sessions, 1); // W2 = index 1
    let shouldProgress = false;
    let progressInfo: string | undefined;

    if (lastW2Session) {
        const maxReps = Math.max(...lastW2Session.sets.map(s => s.reps));
        if (maxReps >= 6) {
            const increment = getIncrement(exercise.equipmentType);
            shouldProgress = true;
            progressInfo = `力量週做到 ${maxReps} 下 (≥6)，下循環 +${increment}kg`;
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
        lastW2: lastW2Session
            ? {
                weight: lastW2Session.sets[0].weight,
                reps: Math.max(...lastW2Session.sets.map(s => s.reps)),
                date: lastW2Session.date,
            }
            : undefined,
    };
}

/** 找最近一次指定 week index 的 session */
function findLastWeekSession(
    exercise: Exercise,
    sessions: WeightWorkoutSession[],
    targetWeekIndex: number
): WeightWorkoutSession | null {
    const history = getExerciseHistory(exercise.id, sessions);
    if (history.length === 0) return null;

    const startDate = exercise.cycleStartDate || history[0].date;
    const relevant = history.filter(s => s.date >= startDate);

    for (let i = relevant.length - 1; i >= 0; i--) {
        if (i % CYCLE_LENGTH === targetWeekIndex) return relevant[i];
    }
    return null;
}

/** 進度概要字串 */
export function getProgressSummary(rec: CycleRecommendation): string {
    const reps = rec.targetRepsMin === rec.targetRepsMax
        ? `${rec.targetRepsMin} 下`
        : `${rec.targetRepsMin}-${rec.targetRepsMax} 下`;
    return `${rec.targetWeight}kg × ${reps} × ${rec.targetSets} 組`;
}
