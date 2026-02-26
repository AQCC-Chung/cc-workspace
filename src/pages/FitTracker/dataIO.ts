import emailjs from '@emailjs/browser';
import type {
    UserBodyData,
    Exercise,
    WeightWorkoutSession,
    CardioRecord,
} from './types';

// ─── Types ───────────────────────────────────────────────────

export interface FitTrackerBackup {
    version: 1;
    exportedAt: string;
    bodyData: UserBodyData;
    exercises: Exercise[];
    weightSessions: WeightWorkoutSession[];
    cardioRecords: CardioRecord[];
}

// ─── EmailJS Config ──────────────────────────────────────────
// User needs to set these after registering at emailjs.com
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';

// ─── Export ──────────────────────────────────────────────────

export function createBackup(
    bodyData: UserBodyData,
    exercises: Exercise[],
    weightSessions: WeightWorkoutSession[],
    cardioRecords: CardioRecord[]
): FitTrackerBackup {
    return {
        version: 1,
        exportedAt: new Date().toISOString(),
        bodyData,
        exercises,
        weightSessions,
        cardioRecords,
    };
}

export function downloadBackup(backup: FitTrackerBackup): void {
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `fittracker-backup-${dateStr}.json`;
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─── Email ───────────────────────────────────────────────────

export async function emailBackup(
    email: string,
    backup: FitTrackerBackup
): Promise<void> {
    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
        throw new Error('EmailJS 尚未設定。請在環境變數中設定 VITE_EMAILJS_SERVICE_ID、VITE_EMAILJS_TEMPLATE_ID、VITE_EMAILJS_PUBLIC_KEY。');
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const jsonString = JSON.stringify(backup, null, 2);

    await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
            to_email: email,
            date: dateStr,
            backup_data: jsonString,
            total_sessions: backup.weightSessions.length,
            total_cardio: backup.cardioRecords.length,
        },
        EMAILJS_PUBLIC_KEY
    );
}

// ─── Import ──────────────────────────────────────────────────

export function parseBackupFile(file: File): Promise<FitTrackerBackup> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);

                // Validate structure
                if (!data.bodyData || !data.exercises || !data.weightSessions || !data.cardioRecords) {
                    throw new Error('檔案格式不正確，缺少必要欄位。');
                }

                resolve(data as FitTrackerBackup);
            } catch (err) {
                reject(new Error(`解析失敗：${(err as Error).message}`));
            }
        };
        reader.onerror = () => reject(new Error('讀取檔案失敗'));
        reader.readAsText(file);
    });
}
