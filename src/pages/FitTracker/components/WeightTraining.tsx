
import React, { useState, useMemo, useEffect } from 'react';
import { Modality } from "@google/genai";
import { geminiGenerate, getGeminiClient } from '../../../utils/gemini';
import {
  Exercise,
  WeightWorkoutSession,
  Unit,
  WorkoutCategory,
  SetRecord,
  EquipmentType
} from '../types';
import { CATEGORIES, CATEGORIES_CN, REST_TIME_SECONDS } from '../constants';
import { getTodayDateString, kgToLbs, lbsToKg, decodeBase64, playRawPcm } from '../utils';
import { getRecommendation, getProgressSummary, getIncrement, type CycleRecommendation } from '../periodization';

interface Props {
  unit: Unit;
  setUnit: (u: Unit) => void;
  exercises: Exercise[];
  setExercises: React.Dispatch<React.SetStateAction<Exercise[]>>;
  sessions: WeightWorkoutSession[];
  setSessions: React.Dispatch<React.SetStateAction<WeightWorkoutSession[]>>;
  onSetComplete: () => void;
  ttsEnabled: boolean;
  periodizationEnabled: boolean;
  setShowPeriodizationInfo?: (show: boolean) => void;
}

const MOTIVATION_QUOTES = [
  "太棒了！這組做得超完美，保持這個節奏，我們下一組一定更強！",
  "嘿！看到你的汗水了嗎？那就是進步的證明！來，深呼吸，下一組繼續衝！",
  "表現得非常陽光！感受肌肉的泵感，你正在變強的路上，加油！",
  "就是這個氣勢！休息一下，調整好呼吸，等一下我們再挑戰一次極限！",
  "很有活力喔！每一組都是新的開始，保持專注，你是最棒的！"
];

const RPE_LABELS: Record<number, string> = {
  1: '極輕', 2: '很輕', 3: '輕鬆', 4: '適中',
  5: '稍累', 6: '有感', 7: '偏重', 8: '很重',
  9: '極重', 10: '極限',
};

// RPE post-exercise: 3 levels
const RPE_LEVELS = [
  { emoji: '😊', label: '輕鬆', value: 4 },
  { emoji: '😐', label: '普通', value: 6 },
  { emoji: '😫', label: '吃力', value: 9 },
];

const WeightTraining: React.FC<Props> = ({
  unit, setUnit, exercises, setExercises, sessions, setSessions, onSetComplete, ttsEnabled, periodizationEnabled
}) => {
  const [selectedCategory, setSelectedCategory] = useState<WorkoutCategory>('Chest');
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExCategory, setNewExCategory] = useState<WorkoutCategory>('Chest');
  const [editingCategory, setEditingCategory] = useState<WorkoutCategory | null>(null);

  const [restEndTime, setRestEndTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const [currentWeight, setCurrentWeight] = useState<number>(40);
  const [currentReps, setCurrentReps] = useState<number>(10);
  const [currentRpe, setCurrentRpe] = useState<number | null>(null);
  const [showRpePopup, setShowRpePopup] = useState(false);
  const [pendingCloseExercise, setPendingCloseExercise] = useState<Exercise | null>(null);

  // Track if user actually added sets *during this view session*
  const [newSetsAddedInSession, setNewSetsAddedInSession] = useState(false);

  // Smart Coach: base weight setup
  const [showBaseWeightSetup, setShowBaseWeightSetup] = useState(false);
  const [setupWeight, setSetupWeight] = useState<number>(40);
  const [setupEquipType, setSetupEquipType] = useState<EquipmentType>('machine');

  // Gemini coach
  const [coachMessage, setCoachMessage] = useState<string | null>(null);
  const [isCoachLoading, setIsCoachLoading] = useState(false);

  useEffect(() => {
    if (!restEndTime) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.round((restEndTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        setRestEndTime(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [restEndTime]);

  const filteredExercises = useMemo(() => {
    return exercises
      .filter(ex => ex.category === selectedCategory)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10);
  }, [exercises, selectedCategory]);

  // Today's summary and total volume calculation
  const todayStats = useMemo(() => {
    const today = getTodayDateString();
    const todaySessions = sessions.filter(s => s.date === today);

    let totalVolume = 0;
    const summary = todaySessions.map(s => {
      const ex = exercises.find(e => e.id === s.exerciseId);
      const exerciseVolume = s.sets.reduce((sum, set) => sum + (set.weight * set.reps), 0);
      totalVolume += exerciseVolume;

      return {
        name: ex?.name || '未知動作',
        setsCount: s.sets.length,
        lastSet: s.sets[s.sets.length - 1]
      };
    });

    return { summary, totalVolume };
  }, [sessions, exercises]);

  const lastWorkout = useMemo(() => {
    if (!activeExercise) return null;
    const pastSessions = sessions
      .filter(s => s.exerciseId === activeExercise.id && s.date !== getTodayDateString())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return pastSessions.length > 0 ? pastSessions[0] : null;
  }, [activeExercise, sessions]);

  const todaySession = useMemo(() => {
    if (!activeExercise) return null;
    return sessions.find(s => s.exerciseId === activeExercise.id && s.date === getTodayDateString());
  }, [activeExercise, sessions]);

  // Smart Coach recommendation
  const recommendation = useMemo<CycleRecommendation | null>(() => {
    if (!activeExercise || !periodizationEnabled) return null;
    return getRecommendation(activeExercise, sessions);
  }, [activeExercise, sessions, periodizationEnabled]);

  // Auto-fill target weight/reps when recommendation changes
  useEffect(() => {
    if (recommendation && !todaySession) {
      setCurrentWeight(recommendation.targetWeight);
      setCurrentReps(recommendation.targetRepsMin);
    }
  }, [recommendation, todaySession]);

  const handleExerciseClick = (ex: Exercise) => {
    // Reset the "added sets" tracker when opening an exercise
    setNewSetsAddedInSession(false);

    if (periodizationEnabled && !ex.baseWeight) {
      setActiveExercise(ex);
      setSetupWeight(40);
      setSetupEquipType(ex.equipmentType || 'machine');
      setShowBaseWeightSetup(true);
    } else {
      setActiveExercise(ex);
    }
  };

  // Close exercise: check if we should show RPE popup
  const handleCloseExercise = () => {
    if (newSetsAddedInSession && activeExercise) {
      setPendingCloseExercise(activeExercise);
      setShowRpePopup(true);
    }
    setActiveExercise(null);
    setRestEndTime(null);
    setCoachMessage(null);
  };

  const handleRpeSubmit = (rpeValue: number | null) => {
    if (rpeValue !== null && pendingCloseExercise) {
      // Save RPE to the last set of today's session
      setSessions(prev => prev.map(s => {
        if (s.exerciseId === pendingCloseExercise.id && s.date === getTodayDateString() && s.sets.length > 0) {
          const updatedSets = [...s.sets];
          updatedSets[updatedSets.length - 1] = { ...updatedSets[updatedSets.length - 1], rpe: rpeValue };
          return { ...s, sets: updatedSets };
        }
        return s;
      }));
    }
    setShowRpePopup(false);
    setPendingCloseExercise(null);
  };

  const handleSaveBaseWeight = () => {
    if (!activeExercise) return;
    setExercises(prev => prev.map(ex =>
      ex.id === activeExercise.id
        ? { ...ex, baseWeight: setupWeight, equipmentType: setupEquipType, cycleStartDate: getTodayDateString() }
        : ex
    ));
    setActiveExercise({ ...activeExercise, baseWeight: setupWeight, equipmentType: setupEquipType, cycleStartDate: getTodayDateString() });
    setShowBaseWeightSetup(false);
  };

  const askGeminiCoach = async () => {
    if (!activeExercise) return;

    setIsCoachLoading(true);
    setCoachMessage(null);
    try {
      const history = sessions
        .filter(s => s.exerciseId === activeExercise.id)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5);

      const historyText = history.map(s =>
        `${s.date}: ${s.sets.map(set => `${set.weight}kg×${set.reps}${set.rpe ? ` RPE${set.rpe}` : ''}`).join(', ')}`
      ).join('\n');

      const recText = recommendation
        ? `目前週期：C${recommendation.cycleNumber}-${recommendation.weekType}（${recommendation.weekLabel}），目標：${getProgressSummary(recommendation)}`
        : '未啟用週期訓練';

      const prompt = `你是一位專業且熱情鼓勵學生的重量訓練教練，用繁體中文回答。適度給予稱讚。

動作：${activeExercise.name}（${activeExercise.equipmentType || '未分類'}）
${recText}

近 5 次紀錄（不一定有RPE，主要看重量與次數變化）：
${historyText || '無歷史紀錄'}

請簡短給出以下三點（不用列點前綴，順順講出來即可）：
1. 一句熱血激勵的話（根據近期的重量/次數變化稍微提一下進步或維持）
2. 今天的訓練建議（專注在感受度、重量維持或小幅突破，不要給太大的壓力）
3. 一個該動作最關鍵的技術要點（例如：注意收核心、手肘微彎之類的）

回覆控制在 80 字以內，語氣要像朋友般鼓勵。`;

      const response = await geminiGenerate({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      setCoachMessage(response.text || '教練暫時無法回應');
    } catch (e) {
      console.error(e);
      const msg = (e as any)?.message || '';
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
        setCoachMessage('API 額度已用完，請等明日重置或到設定頁測試連線');
      } else {
        setCoachMessage('AI 教練暫時無法連線');
      }
    } finally {
      setIsCoachLoading(false);
    }
  };

  const playMotivationVoice = async (activeEx: Exercise, previousSets: SetRecord[], newSet: SetRecord, audioCtx: AudioContext | null) => {
    if (!ttsEnabled || !audioCtx) return;
    try {
      const prompt = `你是一個充滿活力、陽光開朗的年輕健身教練，用語音的方式給予學生一句簡短的鼓勵。
學生剛完成：${activeEx.name}
上一組紀錄：${previousSets.map(s => `${s.weight}kg x ${s.reps}下`).join(', ')}
最新這組：${newSet.weight}kg x ${newSet.reps}下
判斷他是在進步、穩定輸出還是力竭，給出「一句話」的純文字台詞（不加任何標點符號之外的動作描寫，例如不要[笑聲]或*拍肩*），要讓他聽了很有力氣。
例如：「太神啦！重量又突破了！保持節奏我們再來！」字數控制在 30 字以內。`;

      const scriptResponse = await geminiGenerate({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const script = scriptResponse.text || "太棒了，保持這個節奏，我們繼續！";

      const ai = getGeminiClient();
      const ttsResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: script,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Puck' },
            },
          },
        },
      });

      const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioData = decodeBase64(base64Audio);
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        await playRawPcm(audioData, audioCtx);
      }
    } catch (error) {
      console.error("AI 語音激勵播放失敗", error);
    }
  };

  const handleAddSet = () => {
    if (!activeExercise) return;

    // ✨ Safari/iOS Autoplay policy: 必須在 user click 瞬間產生並 resume context
    let audioCtx: AudioContext | null = null;
    if (ttsEnabled) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioCtx = new AudioContextClass({ sampleRate: 24000 });
          audioCtx.resume(); // 先行喚醒
        }
      } catch (e) {
        console.error('AudioContext init error', e);
      }
    }

    const weightInKg = unit === 'LBS' ? lbsToKg(currentWeight) : currentWeight;
    const newSet: SetRecord = {
      weight: weightInKg,
      reps: currentReps,
      timestamp: Date.now(),
      ...(currentRpe !== null ? { rpe: currentRpe } : {}),
    };
    setCurrentRpe(null);

    const date = getTodayDateString();
    const existingSession = sessions.find(s => s.exerciseId === activeExercise.id && s.date === date);
    const prevSets = existingSession ? existingSession.sets : [];

    setSessions(prev => {
      if (existingSession) {
        return prev.map(s => s === existingSession ? { ...s, sets: [...s.sets, newSet] } : s);
      } else {
        return [...prev, { id: Math.random().toString(36).substr(2, 9), date, exerciseId: activeExercise.id, sets: [newSet] }];
      }
    });

    setNewSetsAddedInSession(true);

    setExercises(prev => prev.map(ex =>
      ex.id === activeExercise.id ? { ...ex, usageCount: ex.usageCount + 1 } : ex
    ));

    const endTime = Date.now() + REST_TIME_SECONDS * 1000;
    setRestEndTime(endTime);
    setTimeLeft(REST_TIME_SECONDS);

    playMotivationVoice(activeExercise, prevSets, newSet, audioCtx);
    onSetComplete();
  };

  const skipRest = () => setRestEndTime(null);
  const addExtraRest = () => {
    if (restEndTime) {
      setRestEndTime(restEndTime + 30 * 1000);
    }
  };

  const submitNewExercise = () => {
    if (!newExName.trim()) {
      alert('請輸入動作名稱');
      return;
    }
    const newEx: Exercise = {
      id: Math.random().toString(36).substr(2, 9),
      name: newExName,
      category: newExCategory,
      usageCount: 0
    };
    setExercises(prev => [...prev, newEx]);
    setNewExName('');
    setIsAddingExercise(false);
    setSelectedCategory(newExCategory);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black text-slate-800">重量訓練紀錄</h2>
          <div className="text-right">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">今日累積總重</p>
            <p className="text-lg font-black text-indigo-600 leading-none mt-1">
              {unit === 'LBS' ? kgToLbs(todayStats.totalVolume) : Math.round(todayStats.totalVolume)}
              <small className="text-[10px] ml-1 opacity-70 uppercase font-black">{unit}</small>
            </p>
          </div>
        </div>

        {todayStats.summary.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">今日訓練清單 ({todayStats.summary.length})</p>
            <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar">
              {todayStats.summary.map((sum, i) => (
                <div key={i} className="flex-none bg-slate-50 border border-slate-100 p-3 rounded-2xl min-w-[140px] shadow-sm">
                  <p className="text-xs font-black text-slate-700 truncate">{sum.name}</p>
                  <p className="text-[10px] font-bold text-indigo-500 mt-1">
                    {sum.setsCount} 組 ({unit === 'LBS' ? kgToLbs(sum.lastSet.weight) : sum.lastSet.weight} {unit} × {sum.lastSet.reps})
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm font-bold text-slate-300 italic">今日尚未開始訓練...</p>
        )}
      </div>

      <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar snap-x">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`flex-none px-6 py-3 rounded-2xl text-xs font-black border transition-all snap-start ${selectedCategory === cat
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100'
              : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-200'
              }`}
          >
            {CATEGORIES_CN[cat]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {filteredExercises.map(ex => (
          <button
            key={ex.id}
            onClick={() => handleExerciseClick(ex)}
            className={`p-5 rounded-2xl text-left border transition-all bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm active:scale-95 group relative overflow-hidden`}
          >
            <div className="relative z-10">
              <span className="block text-sm font-black leading-tight mb-2 group-hover:text-indigo-600 transition-colors">{ex.name}</span>
              <div className="flex justify-between items-center">
                <span className="text-[9px] uppercase font-bold text-slate-400">
                  {ex.baseWeight ? `${ex.baseWeight}kg` : '頻次: ' + ex.usageCount}
                </span>
                {todayStats.summary.some(s => s.name === ex.name) && (
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full ring-2 ring-green-100"></span>
                )}
              </div>
            </div>
          </button>
        ))}
        {filteredExercises.length < 10 && (
          <button
            onClick={() => {
              setNewExCategory(selectedCategory);
              setIsAddingExercise(true);
            }}
            className="p-5 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:text-indigo-500 hover:border-indigo-500 transition-all font-black text-xs flex flex-col items-center justify-center gap-2 bg-slate-50/50"
          >
            <span className="text-xl">+</span>
            <span>新增動作</span>
          </button>
        )}
      </div>

      <button
        onClick={() => setEditingCategory(selectedCategory)}
        className="mt-6 w-full p-4 rounded-3xl bg-slate-50 border-2 border-slate-100 text-slate-500 font-bold text-sm hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
      >
        <span>✏️</span> 編輯{CATEGORIES_CN[selectedCategory]}器材名稱
      </button>

      {
        isAddingExercise && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 space-y-6">
              <h3 className="text-xl font-black text-slate-800 text-center">新增訓練動作</h3>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">動作名稱</label>
                <input
                  autoFocus
                  type="text"
                  value={newExName}
                  onChange={(e) => setNewExName(e.target.value)}
                  placeholder="例如：啞鈴飛鳥"
                  className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-slate-700 border-2 border-transparent focus:border-indigo-500 focus:outline-none transition-all"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setIsAddingExercise(false)} className="flex-1 py-4 rounded-2xl font-black text-slate-500 bg-slate-100">取消</button>
                <button onClick={submitNewExercise} className="flex-1 py-4 rounded-2xl font-black text-white bg-indigo-600 shadow-lg">新增</button>
              </div>
            </div>
          </div>
        )
      }

      {
        activeExercise && !showBaseWeightSetup && (
          <div
            className="fixed inset-0 z-[105] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-md animate-in fade-in"
            onClick={handleCloseExercise}
          >
            <div
              className="bg-white/70 backdrop-blur-2xl border border-white/20 w-full max-w-xl max-h-[90vh] rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-[0_32px_64px_-15px_rgba(0,0,0,0.3)] flex flex-col animate-in slide-in-from-bottom-10 duration-500"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-center px-6 pt-6 pb-3 shrink-0">
                <div className="space-y-1 min-w-0 flex-1">
                  <h3 className="text-xl font-black text-slate-900 truncate">{activeExercise.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-700 px-3 py-1 rounded-full uppercase tracking-widest">{CATEGORIES_CN[activeExercise.category]}</span>
                    <div className="flex bg-white/40 p-0.5 rounded-xl border border-white/30">
                      <button onClick={() => setUnit('KG')} className={`px-3 py-1 rounded-lg text-[9px] font-black transition-all ${unit === 'KG' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600'}`}>KG</button>
                      <button onClick={() => setUnit('LBS')} className={`px-3 py-1 rounded-lg text-[9px] font-black transition-all ${unit === 'LBS' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600'}`}>LBS</button>
                    </div>
                  </div>
                </div>
                <button aria-label="關閉" onClick={handleCloseExercise}
                  className="w-10 h-10 bg-white/50 border border-white/40 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 transition-all shrink-0 ml-3"
                >✕</button>
              </div>

              {/* Body */}
              <div className="overflow-y-auto flex-1 px-6 pb-6 space-y-4">

                {/* Smart Coach — one-line compact */}
                {recommendation && (
                  <div className="flex items-center gap-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-4 py-3 rounded-2xl border border-indigo-200/50">
                    <span>🧠</span>
                    <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-700 px-2 py-0.5 rounded-full">{recommendation.weekType} {recommendation.weekLabel}</span>
                    <span className="text-sm font-black text-slate-800 flex-1">{getProgressSummary(recommendation)}</span>
                    {recommendation.shouldProgress && <span className="text-[10px]">💪</span>}
                  </div>
                )}

                {lastWorkout && !recommendation && (
                  <div className="flex items-center justify-between bg-white/40 px-4 py-3 rounded-2xl border border-white/50">
                    <span className="text-[10px] font-black text-slate-400">上次</span>
                    <span className="text-sm font-black text-indigo-700">
                      {unit === 'LBS' ? kgToLbs(lastWorkout.sets[0].weight) : lastWorkout.sets[0].weight}{unit} × {lastWorkout.sets[0].reps}
                    </span>
                    <span className="text-[10px] text-slate-400">{lastWorkout.date}</span>
                  </div>
                )}

                {/* Weight & Reps */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block text-center">重量 ({unit})</label>
                    <div className="flex items-center gap-1">
                      <button aria-label="減少重量" onClick={() => setCurrentWeight(w => Math.max(0, w - 1))} className="w-8 h-12 bg-white/60 rounded-xl text-base font-black text-slate-500 border border-white/40 active:scale-90 transition-all flex items-center justify-center">−</button>
                      <input aria-label={`重量 (${unit})`} type="number" inputMode="decimal" value={currentWeight}
                        onChange={(e) => setCurrentWeight(parseFloat(e.target.value) || 0)}
                        className="flex-1 min-w-0 bg-white/50 py-3 rounded-2xl text-2xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 border border-white/40 text-center shadow-inner"
                      />
                      <button aria-label="增加重量" onClick={() => setCurrentWeight(w => w + 1)} className="w-8 h-12 bg-white/60 rounded-xl text-base font-black text-slate-500 border border-white/40 active:scale-90 transition-all flex items-center justify-center">+</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block text-center">次數</label>
                    <div className="flex items-center gap-1">
                      <button aria-label="減少次數" onClick={() => setCurrentReps(r => Math.max(1, r - 1))} className="w-8 h-12 bg-white/60 rounded-xl text-base font-black text-slate-500 border border-white/40 active:scale-90 transition-all flex items-center justify-center">−</button>
                      <input aria-label="次數" type="number" inputMode="numeric" value={currentReps}
                        onChange={(e) => setCurrentReps(parseInt(e.target.value) || 0)}
                        className="flex-1 min-w-0 bg-white/50 py-3 rounded-2xl text-2xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 border border-white/40 text-center shadow-inner"
                      />
                      <button aria-label="增加次數" onClick={() => setCurrentReps(r => r + 1)} className="w-8 h-12 bg-white/60 rounded-xl text-base font-black text-slate-500 border border-white/40 active:scale-90 transition-all flex items-center justify-center">+</button>
                    </div>
                  </div>
                </div>

                {/* Save / Timer */}
                {!restEndTime ? (
                  <button onClick={handleAddSet}
                    className="w-full bg-indigo-600/90 text-white py-5 rounded-2xl font-black text-lg shadow-[0_20px_40px_-10px_rgba(79,70,229,0.4)] active:scale-95 transition-all"
                  >儲存本組進度</button>
                ) : (
                  <div className="flex gap-3">
                    <div className="flex-1 bg-slate-900/90 text-white rounded-2xl flex flex-col items-center justify-center p-3 relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 bg-indigo-500/30 transition-all duration-1000 ease-linear" style={{ width: `${(timeLeft / REST_TIME_SECONDS) * 100}%` }} />
                      <span className="text-[9px] font-black text-slate-400 uppercase z-10">組間休息中...</span>
                      <span className="text-2xl font-black z-10">{timeLeft}s</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={skipRest} className="px-6 py-2.5 bg-white/50 text-slate-700 rounded-xl font-black text-xs border border-white/40">跳過</button>
                      <button onClick={addExtraRest} className="px-6 py-2.5 bg-indigo-500/20 text-indigo-700 rounded-xl font-black text-xs border border-white/40">+30s</button>
                    </div>
                  </div>
                )}

                {/* AI Coach */}
                <button onClick={askGeminiCoach} disabled={isCoachLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-black bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-200/50 text-purple-700 active:scale-95 disabled:opacity-50"
                >
                  {isCoachLoading ? (<>⏳ 教練思考中...</>) : (<>🤖 問問 AI 教練</>)}
                </button>
                {coachMessage && (
                  <div className="bg-purple-50/80 border border-purple-200/50 rounded-2xl p-3">
                    <p className="text-[11px] font-bold text-purple-800 leading-relaxed whitespace-pre-line">{coachMessage}</p>
                  </div>
                )}

                {/* Today's Progress */}
                {todaySession && (
                  <div className="border-t border-white/30 pt-3">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex justify-between">
                      <span>當前進度</span>
                      <span className="text-indigo-600">已完成 {todaySession.sets.length} 組</span>
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {todaySession.sets.map((set, idx) => (
                        <div key={idx} className="bg-white/40 px-2 py-1.5 rounded-xl text-[10px] font-black border border-white/50 text-center">
                          <span className="text-slate-400">#{idx + 1} </span>
                          <span className="text-slate-700">{unit === 'LBS' ? kgToLbs(set.weight) : set.weight}×{set.reps}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )
      }

      {/* Base Weight Setup Modal */}
      {
        showBaseWeightSetup && activeExercise && (
          <div
            className="fixed inset-0 z-[115] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
            onClick={() => { setShowBaseWeightSetup(false); setActiveExercise(null); }}
          >
            <div
              className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 space-y-6 animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🧠</div>
                <h2 className="text-xl font-black text-slate-800">設定基準重量</h2>
                <p className="text-sm font-bold text-slate-500">{activeExercise.name}</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-[11px] font-bold text-amber-700 leading-relaxed">
                  💡 <strong>W1 基準重量</strong>：選擇你能做 <strong>4-6 下</strong>且維持標準姿勢的最大重量。Smart Coach 會根據這個基準自動計算每週的目標。
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">基準重量 (KG)</label>
                  <input
                    type="number"
                    value={setupWeight}
                    onChange={(e) => setSetupWeight(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-2xl font-black text-slate-700 text-center focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">器材類型</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['barbell', 'dumbbell', 'machine'] as EquipmentType[]).map(type => (
                      <button
                        key={type}
                        onClick={() => setSetupEquipType(type)}
                        className={`py-3 rounded-2xl text-xs font-black transition-all ${setupEquipType === type
                          ? 'bg-indigo-600 text-white shadow-lg'
                          : 'bg-slate-50 text-slate-500 border border-slate-200'
                          }`}
                      >
                        {type === 'barbell' ? '槓鈴' : type === 'dumbbell' ? '啞鈴' : '器械'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-400 text-center">
                    進階增量：槓鈴 +5kg / 啞鈴·器械 +2.5kg
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowBaseWeightSetup(false); setActiveExercise(null); }}
                  className="flex-1 py-4 rounded-2xl font-black text-slate-500 bg-slate-100"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveBaseWeight}
                  className="flex-1 py-4 rounded-2xl font-black text-white bg-indigo-600 shadow-lg"
                >
                  開始訓練
                </button>
              </div>
            </div>
          </div>
        )
      }
      {/* RPE Post-Exercise Popup */}
      {
        showRpePopup && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white w-full max-w-xs rounded-[2.5rem] shadow-2xl p-8 space-y-6 animate-in zoom-in-95 duration-200">
              <div className="text-center space-y-2">
                <h2 className="text-lg font-black text-slate-800">今天這個動作感覺如何？</h2>
                <p className="text-[11px] text-slate-400">{pendingCloseExercise?.name}</p>
              </div>
              <div className="flex gap-3">
                {RPE_LEVELS.map(level => (
                  <button
                    key={level.value}
                    onClick={() => handleRpeSubmit(level.value)}
                    className="flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl border-2 border-slate-100 hover:border-indigo-400 hover:bg-indigo-50 transition-all active:scale-95"
                  >
                    <span className="text-3xl">{level.emoji}</span>
                    <span className="text-xs font-black text-slate-600">{level.label}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => handleRpeSubmit(null)} className="w-full py-3 text-sm font-bold text-slate-400">跳過</button>
            </div>
          </div>
        )
      }

      {/* Edit Equipment Modal */}
      {
        editingCategory && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setEditingCategory(null)}>
            <div className="bg-white w-full max-w-sm h-auto max-h-[80vh] flex flex-col rounded-[2.5rem] shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6 px-1">
                <h3 className="text-xl font-black text-slate-800 tracking-tight">編輯{CATEGORIES_CN[editingCategory]}器材</h3>
                <button aria-label="關閉" onClick={() => setEditingCategory(null)} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">✕</button>
              </div>
              <div className="overflow-y-auto pr-2 space-y-3 flex-1 no-scrollbar">
                {exercises.filter(ex => ex.category === editingCategory).map(ex => (
                  <div key={ex.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="font-bold text-slate-700 text-sm truncate pr-2">{ex.name}</span>
                    <button
                      onClick={() => {
                        const newName = window.prompt(`請輸入 [${ex.name}] 的新名稱：`, ex.name);
                        if (newName && newName.trim() !== '' && newName !== ex.name) {
                          setExercises(prev => prev.map(e => e.id === ex.id ? { ...e, name: newName.trim() } : e));
                        }
                      }}
                      className="px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 font-black text-xs whitespace-nowrap hover:bg-indigo-100 transition-colors shadow-sm"
                    >
                      修改
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-2">
                <button onClick={() => setEditingCategory(null)} className="w-full py-4 rounded-xl font-black text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">關閉</button>
              </div>
            </div>
          </div>
        )
      }
    </div>
  );
};

export default WeightTraining;
