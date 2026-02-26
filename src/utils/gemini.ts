/**
 * Gemini API helper with dual-key fallback.
 * Uses free key first; on quota error (429), retries with paid key.
 */
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';

const FREE_KEY = import.meta.env.VITE_GEMINI_API_KEY_FREE;
const PAID_KEY = import.meta.env.VITE_GEMINI_API_KEY_PAID;

// Track which key is currently active in this session
let currentKeyIndex = 0; // 0 = free, 1 = paid

function getKeys(): string[] {
    const keys: string[] = [];
    if (FREE_KEY) keys.push(FREE_KEY);
    if (PAID_KEY) keys.push(PAID_KEY);
    return keys;
}

function isQuotaError(error: any): boolean {
    const msg = String(error?.message || '');
    return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');
}

/**
 * Call Gemini generateContent with automatic key fallback.
 */
export async function geminiGenerate(
    params: { model: string; contents: any }
): Promise<GenerateContentResponse> {
    const keys = getKeys();
    if (keys.length === 0) {
        throw new Error('Gemini API Key 未設定');
    }

    // Start from currentKeyIndex
    for (let i = currentKeyIndex; i < keys.length; i++) {
        try {
            const ai = new GoogleGenAI({ apiKey: keys[i] });
            const response = await ai.models.generateContent(params);
            return response;
        } catch (e: any) {
            if (isQuotaError(e) && i + 1 < keys.length) {
                // Quota exceeded, try next key
                console.warn(`Gemini key #${i + 1} quota exceeded, switching to key #${i + 2}`);
                currentKeyIndex = i + 1;
                continue;
            }
            throw e;
        }
    }

    throw new Error('所有 Gemini API Key 額度已用完');
}

/**
 * Get a GoogleGenAI instance for advanced usage (e.g. TTS).
 * Returns the currently active key.
 */
export function getGeminiClient(): GoogleGenAI {
    const keys = getKeys();
    if (keys.length === 0) {
        throw new Error('Gemini API Key 未設定');
    }
    const key = keys[Math.min(currentKeyIndex, keys.length - 1)];
    return new GoogleGenAI({ apiKey: key });
}

/**
 * Test the Gemini API connection. Returns status info.
 */
export async function testGeminiConnection(): Promise<{
    status: 'ok' | 'error';
    message: string;
    activeKey: number;
}> {
    const keys = getKeys();
    if (keys.length === 0) {
        return { status: 'error', message: 'API Key 未設定', activeKey: 0 };
    }

    for (let i = 0; i < keys.length; i++) {
        try {
            const ai = new GoogleGenAI({ apiKey: keys[i] });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: '回覆「OK」兩個字即可',
            });
            if (response.text) {
                currentKeyIndex = i;
                return {
                    status: 'ok',
                    message: `連線正常（使用${i === 0 ? '免費' : '付費'} Key #${i + 1}）`,
                    activeKey: i,
                };
            }
        } catch (e: any) {
            if (isQuotaError(e) && i + 1 < keys.length) {
                continue; // Try next key
            }
            const msg = String(e?.message || '');
            if (msg.includes('401') || msg.includes('API_KEY_INVALID')) {
                if (i + 1 < keys.length) continue;
                return { status: 'error', message: 'API Key 無效', activeKey: i };
            }
            if (isQuotaError(e)) {
                return { status: 'error', message: '所有 API Key 額度已用完，請等明日重置', activeKey: i };
            }
            return { status: 'error', message: '連線失敗：' + msg.slice(0, 80), activeKey: i };
        }
    }

    return { status: 'error', message: '所有 API Key 額度已用完', activeKey: keys.length - 1 };
}
