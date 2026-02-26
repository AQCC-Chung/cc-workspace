
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

// ─── GAS Backup Config ──────────────────────────────────────────
export const GAS_BACKUP_URL = 'https://script.google.com/macros/s/AKfycbzIrZVTbwXIig_Xd3_rkZgr9j8W-IalCWie7Mv8JpucVasEqitcopw3WXPRVHl339aU/exec';

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
    if (!GAS_BACKUP_URL) {
        throw new Error('GAS Backup API 網址尚未設定。');
    }

    const dateStr = new Date().toISOString().split('T')[0];

    // We send payload as text/plain to bypass CORS preflight issues with GAS.
    const payload = {
        email: email,
        date: dateStr,
        backupData: backup
    };

    const response = await fetch(GAS_BACKUP_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`伺服器錯誤: ${response.status}`);
    }

    const result = await response.json();
    if (result.status === 'error') {
        throw new Error(`API回傳錯誤: ${result.message}`);
    }
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
