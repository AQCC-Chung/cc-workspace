
import { KG_TO_LBS } from './constants';

export const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const kgToLbs = (kg: number) => Math.round(kg * KG_TO_LBS * 10) / 10;
export const lbsToKg = (lbs: number) => Math.round((lbs / KG_TO_LBS) * 10) / 10;

export const calculateBMR = (weight: number, height: number, age: number): number => {
  return 10 * weight + 6.25 * height - 5 * age;
};

export const calculateExerciseKcal = (met: number, weightKg: number, durationMinutes: number): number => {
  return (met * weightKg * (durationMinutes / 60));
};

export const getTodayDateString = () => new Date().toISOString().split('T')[0];

export const getDailyStats = (
  weightSessions: any[], 
  cardioRecords: any[], 
  bodyData: any,
  dateString: string
) => {
  const dayWeightSessions = weightSessions.filter(s => s.date === dateString);
  const dayCardioRecords = cardioRecords.filter(r => r.date === dateString);

  let timeSeconds = 0;
  let allTimestamps: number[] = [];
  dayWeightSessions.forEach(session => {
    session.sets.forEach((set: any) => allTimestamps.push(set.timestamp));
  });

  if (allTimestamps.length > 0) {
    const minTs = Math.min(...allTimestamps);
    const maxTs = Math.max(...allTimestamps);
    timeSeconds = Math.round((maxTs - minTs) / 1000);
  }

  let totalKcal = 0;
  dayCardioRecords.forEach(record => {
    if (record.kcal) {
      totalKcal += record.kcal;
    } else {
      totalKcal += calculateExerciseKcal(7, bodyData.weight, record.duration);
    }
  });

  if (timeSeconds > 0) {
    totalKcal += calculateExerciseKcal(5, bodyData.weight, timeSeconds / 60);
  }

  return {
    totalKcal: Math.round(totalKcal * 10) / 10,
    trainingTimeSeconds: timeSeconds
  };
};

// --- Audio Helpers for Gemini TTS ---

export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function playRawPcm(
  data: Uint8Array,
  sampleRate: number = 24000,
  numChannels: number = 1
) {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const audioBuffer = audioCtx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }

  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);
  source.start();
}
