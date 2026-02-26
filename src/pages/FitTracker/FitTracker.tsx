
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

const App: React.FC = () => {
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

  const [gasUrl, setGasUrl] = useState<string>(() =>
    localStorage.getItem('gasUrl') || 'https://script.google.com/macros/s/AKfycbyKrAXjUKAoZVCvPmU7ZrfZN6rU7e4KL1evBb1oSKr3k-xyGovOqT1mmlE1gZZfY5S6TA/exec'
  );

  const [unit, setUnit] = useState<Unit>('KG');
  const [activeTab, setActiveTab] = useState<ViewType>('WEIGHT');
  const [timerEnd, setTimerEnd] = useState<number | null>(null);
  const [showBodyModal, setShowBodyModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync with localStorage
  useEffect(() => {
    localStorage.setItem('bodyData', JSON.stringify(bodyData));
    localStorage.setItem('exercises', JSON.stringify(exercises));
    localStorage.setItem('weightSessions', JSON.stringify(weightSessions));
    localStorage.setItem('cardioRecords', JSON.stringify(cardioRecords));
    localStorage.setItem('gasUrl', gasUrl);
  }, [bodyData, exercises, weightSessions, cardioRecords, gasUrl]);

  const todayStr = getTodayDateString();
  const stats = useMemo(() =>
    getDailyStats(weightSessions, cardioRecords, bodyData, todayStr),
    [weightSessions, cardioRecords, bodyData, todayStr]
  );

  const startRestTimer = useCallback(() => {
    setTimerEnd(Date.now() + REST_TIME_SECONDS * 1000);
  }, []);

  const handleCloudSync = async (mode: 'UPLOAD' | 'DOWNLOAD') => {
    if (!gasUrl) {
      setShowSettings(true);
      return;
    }

    setIsSyncing(true);
    try {
      if (mode === 'UPLOAD') {
        const payload = { bodyData, exercises, weightSessions, cardioRecords };
        // GAS using POST requires no-cors sometimes for simple fetch, 
        // but it won't let you see the result. Standard CORS is better if GAS is set up for it.
        await fetch(gasUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        alert('備份指令已送出！資料將同步至 Google Sheets。');
      } else {
        const response = await fetch(gasUrl);
        const data = await response.json();
        if (data) {
          if (data.bodyData) setBodyData(data.bodyData);
          if (data.exercises) setExercises(data.exercises);
          if (data.weightSessions) setWeightSessions(data.weightSessions);
          if (data.cardioRecords) setCardioRecords(data.cardioRecords);
          alert('同步成功！已從雲端載入最新資料');
        }
      }
    } catch (e) {
      console.error(e);
      alert('同步失敗，請確認 GAS 腳本部署權限或網址是否正確。');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-10 pt-16">
      <header className="sticky top-0 z-50 bg-[#0f172a] text-white shadow-2xl border-b border-slate-800">
        <div className="px-5 pt-5 pb-3 flex justify-between items-center">
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
                {gasUrl && (
                  <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-400 animate-pulse' : 'bg-green-500'}`}></div>
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

      <main className="max-w-xl mx-auto w-full p-4 space-y-6">
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
          url={gasUrl}
          setUrl={setGasUrl}
          onClose={() => setShowSettings(false)}
          onSync={handleCloudSync}
          isSyncing={isSyncing}
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

export default App;
