
import React, { useState, useMemo, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
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
}

const MOTIVATION_QUOTES = [
  "太棒了！這組做得超完美，保持這個節奏，我們下一組一定更強！",
  "嘿！看到你的汗水了嗎？那就是進步的證明！來，深呼吸，下一組繼續衝！",
  "表現得非常陽光！感受肌肉的泵感，你正在變強的路上，加油！",
  "就是這個氣勢！休息一下，調整好呼吸，等一下我們再挑戰一次極限！",
  "很有活力喔！每一組都是新的開始，保持專注，你是最棒的！"
];

const WeightTraining: React.FC<Props> = ({
  unit, setUnit, exercises, setExercises, sessions, setSessions, onSetComplete
}) => {
  const [selectedCategory, setSelectedCategory] = useState<WorkoutCategory>('Chest');
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExCategory, setNewExCategory] = useState<WorkoutCategory>('Chest');

  const [restEndTime, setRestEndTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const [currentWeight, setCurrentWeight] = useState<number>(40);
  const [currentReps, setCurrentReps] = useState<number>(10);
  const [currentRpe, setCurrentRpe] = useState<number | null>(null);

  // Smart Coach: base weight setup
  const [showBaseWeightSetup, setShowBaseWeightSetup] = useState(false);
  const [setupWeight, setSetupWeight] = useState<number>(40);
  const [setupEquipType, setSetupEquipType] = useState<EquipmentType>('machine');

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
    if (!activeExercise) return null;
    return getRecommendation(activeExercise, sessions);
  }, [activeExercise, sessions]);

  // Auto-fill target weight/reps when recommendation changes
  useEffect(() => {
    if (recommendation && !todaySession) {
      setCurrentWeight(recommendation.targetWeight);
      setCurrentReps(recommendation.targetRepsMin);
    }
  }, [recommendation, todaySession]);

  const handleExerciseClick = (ex: Exercise) => {
    if (!ex.baseWeight) {
      setActiveExercise(ex);
      setSetupWeight(40);
      setSetupEquipType(ex.equipmentType || 'machine');
      setShowBaseWeightSetup(true);
    } else {
      setActiveExercise(ex);
    }
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

  const playMotivationVoice = async () => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const randomQuote = MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)];

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `請用活潑、開朗且陽光的年輕男生嗓音說：${randomQuote}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Puck' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioData = decodeBase64(base64Audio);
        await playRawPcm(audioData);
      }
    } catch (error) {
      console.error("AI 語音激勵播放失敗", error);
    }
  };

  const handleAddSet = () => {
    if (!activeExercise) return;

    const weightInKg = unit === 'LBS' ? lbsToKg(currentWeight) : currentWeight;
    const newSet: SetRecord = {
      weight: weightInKg,
      reps: currentReps,
      timestamp: Date.now(),
      ...(currentRpe !== null ? { rpe: currentRpe } : {}),
    };
    setCurrentRpe(null);

    setSessions(prev => {
      const date = getTodayDateString();
      const existing = prev.find(s => s.exerciseId === activeExercise.id && s.date === date);

      if (existing) {
        return prev.map(s => s === existing ? { ...s, sets: [...s.sets, newSet] } : s);
      } else {
        return [...prev, { id: Math.random().toString(36).substr(2, 9), date, exerciseId: activeExercise.id, sets: [newSet] }];
      }
    });

    setExercises(prev => prev.map(ex =>
      ex.id === activeExercise.id ? { ...ex, usageCount: ex.usageCount + 1 } : ex
    ));

    const endTime = Date.now() + REST_TIME_SECONDS * 1000;
    setRestEndTime(endTime);
    setTimeLeft(REST_TIME_SECONDS);

    playMotivationVoice();
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

      {isAddingExercise && (
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
      )}

      {activeExercise && (
        <div
          className="fixed inset-0 z-[105] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-md animate-in fade-in"
          onClick={() => { setActiveExercise(null); setRestEndTime(null); }}
        >
          <div
            className="bg-white/70 backdrop-blur-2xl border border-white/20 w-full max-w-xl rounded-t-[3rem] sm:rounded-[3rem] shadow-[0_32px_64px_-15px_rgba(0,0,0,0.3)] p-8 space-y-8 animate-in slide-in-from-bottom-10 duration-500"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-slate-900 drop-shadow-sm">{activeExercise.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-700 px-3 py-1 rounded-full uppercase tracking-widest">{CATEGORIES_CN[activeExercise.category]}</span>
                  <div className="flex bg-white/40 p-0.5 rounded-xl border border-white/30 backdrop-blur-md">
                    <button onClick={() => setUnit('KG')} className={`px-3 py-1 rounded-lg text-[9px] font-black transition-all ${unit === 'KG' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600'}`}>KG</button>
                    <button onClick={() => setUnit('LBS')} className={`px-3 py-1 rounded-lg text-[9px] font-black transition-all ${unit === 'LBS' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600'}`}>LBS</button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setActiveExercise(null); setRestEndTime(null); }}
                className="w-12 h-12 bg-white/50 backdrop-blur-md border border-white/40 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 transition-all hover:rotate-90"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-8">
              {/* Smart Coach Card */}
              {recommendation && (
                <div className="col-span-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 backdrop-blur-md p-5 rounded-[2rem] border border-indigo-200/50 shadow-sm space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🧠</span>
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Smart Coach</span>
                    </div>
                    <span className="text-[9px] font-black bg-indigo-500/20 text-indigo-700 px-3 py-1 rounded-full">
                      C{recommendation.cycleNumber}-{recommendation.weekType} {recommendation.weekLabel}
                    </span>
                  </div>
                  <p className="text-lg font-black text-slate-800">
                    🎯 {getProgressSummary(recommendation)}
                  </p>
                  {recommendation.lastW1 && (
                    <p className="text-[10px] font-bold text-slate-500">
                      📊 上次 W1：{recommendation.lastW1.weight}kg × {recommendation.lastW1.reps} 下（{recommendation.lastW1.date}）
                    </p>
                  )}
                  {recommendation.shouldProgress && (
                    <p className="text-[10px] font-black text-emerald-600">
                      💪 {recommendation.progressInfo}
                    </p>
                  )}
                </div>
              )}

              {lastWorkout && !recommendation && (
                <div className="col-span-2 bg-white/40 backdrop-blur-md p-5 rounded-[2rem] border border-white/50 flex justify-between items-center shadow-sm">
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">上次表現</p>
                    <p className="text-lg font-black text-indigo-700">
                      {unit === 'LBS' ? kgToLbs(lastWorkout.sets[0].weight) : lastWorkout.sets[0].weight} {unit} × {lastWorkout.sets[0].reps} 次
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400">{lastWorkout.date}</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block text-center">訓練重量 ({unit})</label>
                <input
                  type="number"
                  value={currentWeight}
                  onChange={(e) => setCurrentWeight(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white/50 backdrop-blur-md p-6 rounded-[2rem] text-4xl font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 border border-white/40 text-center transition-all shadow-inner"
                />
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block text-center">次數 (Reps)</label>
                <input
                  type="number"
                  value={currentReps}
                  onChange={(e) => setCurrentReps(parseInt(e.target.value) || 0)}
                  className="w-full bg-white/50 backdrop-blur-md p-6 rounded-[2rem] text-4xl font-black text-slate-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 border border-white/40 text-center transition-all shadow-inner"
                />
              </div>
            </div>

            {/* RPE Input */}
            <div className="pt-2">
              <div className="flex items-center gap-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">RPE</label>
                <div className="flex-1 flex gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(v => (
                    <button
                      key={v}
                      onClick={() => setCurrentRpe(currentRpe === v ? null : v)}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${currentRpe === v
                          ? v >= 9 ? 'bg-red-500 text-white shadow-lg' : v >= 7 ? 'bg-amber-500 text-white shadow-lg' : 'bg-indigo-500 text-white shadow-lg'
                          : 'bg-white/40 text-slate-400 border border-white/30'
                        }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2">
              {!restEndTime ? (
                <button
                  onClick={handleAddSet}
                  className="w-full bg-indigo-600/90 hover:bg-indigo-600 text-white py-6 rounded-[2rem] font-black text-xl shadow-[0_20px_40px_-10px_rgba(79,70,229,0.4)] active:scale-95 transition-all backdrop-blur-md"
                >
                  儲存本組進度
                </button>
              ) : (
                <div className="w-full flex gap-4 animate-in zoom-in-95">
                  <div className="flex-1 bg-slate-900/90 text-white rounded-[2rem] flex flex-col items-center justify-center p-4 relative overflow-hidden backdrop-blur-md">
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-indigo-500/30 transition-all duration-1000 ease-linear"
                      style={{ width: `${(timeLeft / REST_TIME_SECONDS) * 100}%` }}
                    />
                    <span className="text-[9px] font-black text-slate-400 uppercase z-10">組間休息中...</span>
                    <span className="text-3xl font-black z-10">{timeLeft}s</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={skipRest} className="px-8 py-3 bg-white/50 text-slate-700 rounded-2xl font-black text-xs hover:bg-white/80 transition-colors border border-white/40">跳過</button>
                    <button onClick={addExtraRest} className="px-8 py-3 bg-indigo-500/20 text-indigo-700 rounded-2xl font-black text-xs hover:bg-indigo-500/30 transition-colors border border-white/40">+30s</button>
                  </div>
                </div>
              )}
            </div>

            {todaySession && (
              <div className="pt-4 border-t border-white/30">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex justify-between">
                  <span>當前進度</span>
                  <span className="text-indigo-600 font-black">已完成 {todaySession.sets.length} 組</span>
                </p>
                <div className="grid grid-cols-2 gap-3 max-h-32 overflow-y-auto no-scrollbar">
                  {todaySession.sets.map((set, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white/40 backdrop-blur-sm px-5 py-3 rounded-2xl text-[11px] font-black border border-white/50 shadow-sm">
                      <span className="text-slate-400"># {idx + 1}</span>
                      <span className="text-slate-800">{unit === 'LBS' ? kgToLbs(set.weight) : set.weight} {unit} × {set.reps}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Base Weight Setup Modal */}
      {showBaseWeightSetup && activeExercise && (
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
      )}
    </div>
  );
};

export default WeightTraining;
