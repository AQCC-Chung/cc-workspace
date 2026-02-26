
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  UserBodyData,
  Exercise,
  WeightWorkoutSession,
  CardioRecord,
  ViewType,
  Unit,
  WorkoutCategory
} from './types';
import { createBackup, downloadBackup, emailBackup, parseBackupFile } from './dataIO';
import {
  INITIAL_EXERCISES,
  REST_TIME_SECONDS,
} from './constants';
import {
  formatTime,
  getTodayDateString,
  getDailyStats
} from './utils';

// Components
import BodyDataSection from './components/BodyDataSection';
import WeightTraining from './components/WeightTraining';
import Cardio from './components/Cardio';
import CalendarView from './components/CalendarView';
import Timer from './components/Timer';
import SettingsModal from './components/SettingsModal';

const FitTracker: React.FC = () => {
  // Persistence states
  const [bodyData, setBodyData] = useState<UserBodyData>(() => {
    const saved = localStorage.getItem('bodyData');
    return saved ? JSON.parse(saved) : { weight: 70, height: 175, age: 25 };
  });

  const [exercises, setExercises] = useState<Exercise[]>(() => {
    const saved = localStorage.getItem('exercises');
    return saved ? JSON.parse(saved) : INITIAL_EXERCISES;
  });

  const [weightSessions, setWeightSessions] = useState<WeightWorkoutSession[]>(() => {
    const saved = localStorage.getItem('weightSessions');
    return saved ? JSON.parse(saved) : [];
  });

  const [cardioRecords, setCardioRecords] = useState<CardioRecord[]>(() => {
    const saved = localStorage.getItem('cardioRecords');
    return saved ? JSON.parse(saved) : [];
  });

  const [userEmail, setUserEmail] = useState<string>(() =>
    localStorage.getItem('fittracker_email') || ''
  );

  const [unit, setUnit] = useState<Unit>('KG');
  const [activeTab, setActiveTab] = useState<ViewType>('WEIGHT');
  const [timerEnd, setTimerEnd] = useState<number | null>(null);
  const [showBodyModal, setShowBodyModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('fittracker_tts');
    return saved !== null ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem('fittracker_tts', JSON.stringify(ttsEnabled));
  }, [ttsEnabled]);

  // Sync with localStorage
  useEffect(() => {
    localStorage.setItem('bodyData', JSON.stringify(bodyData));
    localStorage.setItem('exercises', JSON.stringify(exercises));
    localStorage.setItem('weightSessions', JSON.stringify(weightSessions));
    localStorage.setItem('cardioRecords', JSON.stringify(cardioRecords));
    localStorage.setItem('fittracker_email', userEmail);
  }, [bodyData, exercises, weightSessions, cardioRecords, userEmail]);

  const todayStr = getTodayDateString();
  const stats = useMemo(() =>
    getDailyStats(weightSessions, cardioRecords, bodyData, todayStr),
    [weightSessions, cardioRecords, bodyData, todayStr]
  );

  const startRestTimer = useCallback(() => {
    setTimerEnd(Date.now() + REST_TIME_SECONDS * 1000);
  }, []);

  const handleDownload = () => {
    const backup = createBackup(bodyData, exercises, weightSessions, cardioRecords);
    downloadBackup(backup);
    alert('備份檔已下載！');
  };

  const handleEmailBackup = async () => {
    if (!userEmail) return;
    setIsSyncing(true);
    try {
      const backup = createBackup(bodyData, exercises, weightSessions, cardioRecords);
      await emailBackup(userEmail, backup);
      alert(`備份已寄送至 ${userEmail}！`);
    } catch (e) {
      console.error(e);
      alert(`寄送失敗：${(e as Error).message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImport = async (file: File) => {
    try {
      const backup = await parseBackupFile(file);
      setBodyData(backup.bodyData);
      setExercises(backup.exercises);
      setWeightSessions(backup.weightSessions);
      setCardioRecords(backup.cardioRecords);
      alert('資料已成功還原！');
    } catch (e) {
      alert(`匯入失敗：${(e as Error).message}`);
    }
  };

  const hasEmailConfig = !!(import.meta.env.VITE_EMAILJS_SERVICE_ID);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-10 pt-16 relative">
      <header className="fixed top-16 left-0 right-0 z-40 bg-[#0f172a] text-white shadow-2xl border-b border-slate-800 transition-transform">
        <div className="px-5 pt-5 pb-3 flex justify-between items-center max-w-xl mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors"
            >
              ⚙️
            </button>
            <div className="flex flex-col">
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                <span className="bg-indigo-600 px-2 py-0.5 rounded italic text-sm">FIT</span>
                <span>TRACKER</span>
              </h1>
              <div className="flex items-center gap-1.5 mt-1">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{todayStr}</p>
                {isSyncing && (
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></div>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">消耗能量</span>
              <p className="text-lg font-black text-indigo-400 leading-none mt-1">{stats.totalKcal} <small className="text-[8px]">KCAL</small></p>
            </div>
            <div className="w-px h-8 bg-slate-800"></div>
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">累積時間</span>
              <p className="text-lg font-black text-white leading-none mt-1">{formatTime(stats.trainingTimeSeconds)}</p>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={() => setShowBodyModal(true)}
            className="w-full bg-slate-800/40 hover:bg-slate-800/80 transition-all border border-slate-700/50 rounded-2xl p-4 flex justify-between items-center group backdrop-blur-md"
          >
            <div className="flex items-center gap-5">
              <div className="flex flex-col items-start">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Weight</span>
                <span className="text-sm font-black text-slate-200">{bodyData.weight}<small className="text-[10px] ml-0.5 opacity-60">kg</small></span>
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Height</span>
                <span className="text-sm font-black text-slate-200">{bodyData.height}<small className="text-[10px] ml-0.5 opacity-60">cm</small></span>
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Age</span>
                <span className="text-sm font-black text-slate-200">{bodyData.age}<small className="text-[10px] ml-0.5 opacity-60">y</small></span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-500/20">
              <span className="text-[10px] font-black text-indigo-400">數據更新</span>
              <span className="text-indigo-400 group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto w-full p-4 space-y-6 mt-[140px]">
        <nav className="flex p-1.5 bg-slate-200/50 rounded-2xl shadow-inner border border-slate-200/50 backdrop-blur-sm">
          {(['WEIGHT', 'CARDIO', 'CALENDAR'] as ViewType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3.5 text-xs font-black rounded-xl transition-all duration-300 ${activeTab === tab
                ? 'bg-white text-indigo-600 shadow-xl shadow-indigo-100 transform scale-[1.02]'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              {tab === 'WEIGHT' ? '重量訓練' : tab === 'CARDIO' ? '有氧運動' : '訓練日誌'}
            </button>
          ))}
        </nav>

        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          {activeTab === 'WEIGHT' && (
            <WeightTraining
              unit={unit}
              setUnit={setUnit}
              exercises={exercises}
              setExercises={setExercises}
              sessions={weightSessions}
              setSessions={setWeightSessions}
              onSetComplete={startRestTimer}
              ttsEnabled={ttsEnabled}
            />
          )}
          {activeTab === 'CARDIO' && (
            <Cardio
              weight={bodyData.weight}
              records={cardioRecords}
              setRecords={setCardioRecords}
            />
          )}
          {activeTab === 'CALENDAR' && (
            <CalendarView
              weightSessions={weightSessions}
              cardioRecords={cardioRecords}
              exercises={exercises}
            />
          )}
        </div>
      </main>

      {showBodyModal && (
        <BodyDataSection
          data={bodyData}
          onUpdate={(newData) => setBodyData(newData)}
          onClose={() => setShowBodyModal(false)}
        />
      )}

      {showSettings && (
        <SettingsModal
          userEmail={userEmail}
          setUserEmail={setUserEmail}
          onClose={() => setShowSettings(false)}
          onDownload={handleDownload}
          onEmailBackup={handleEmailBackup}
          onImport={handleImport}
          isSyncing={isSyncing}
          hasEmailConfig={hasEmailConfig}
          ttsEnabled={ttsEnabled}
          setTtsEnabled={setTtsEnabled}
        />
      )}

      {timerEnd && (
        <Timer
          endTime={timerEnd}
          onClose={() => setTimerEnd(null)}
        />
      )}
    </div>
  );
};

export default FitTracker;
