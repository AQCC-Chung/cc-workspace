
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
import { createBackup, downloadBackup, emailBackup, parseBackupFile, GAS_BACKUP_URL } from './dataIO';
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
  // We check if "bodyData" exists in local storage to determine if the user is completely new.
  const isFirstTime = !localStorage.getItem('bodyData');

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
  const [showBodyModal, setShowBodyModal] = useState(isFirstTime);
  const [showSettings, setShowSettings] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('fittracker_tts');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Periodization toggle (migrated from WeightTraining)
  const [periodizationEnabled, setPeriodizationEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('fittracker_periodization');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [showPeriodizationInfo, setShowPeriodizationInfo] = useState(false);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('bodyData', JSON.stringify(bodyData));
  }, [bodyData]);

  useEffect(() => {
    localStorage.setItem('exercises', JSON.stringify(exercises));
  }, [exercises]);

  useEffect(() => {
    localStorage.setItem('weightSessions', JSON.stringify(weightSessions));
  }, [weightSessions]);

  useEffect(() => {
    localStorage.setItem('cardioRecords', JSON.stringify(cardioRecords));
  }, [cardioRecords]);

  useEffect(() => {
    localStorage.setItem('fittracker_tts', JSON.stringify(ttsEnabled));
  }, [ttsEnabled]);

  useEffect(() => {
    localStorage.setItem('fittracker_periodization', JSON.stringify(periodizationEnabled));
  }, [periodizationEnabled]);

  useEffect(() => {
    localStorage.setItem('fittracker_email', userEmail);
  }, [userEmail]);

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

  const hasEmailConfig = !!GAS_BACKUP_URL;

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
      </header >

      <main className="max-w-xl mx-auto w-full p-4 space-y-6 mt-[88px]">
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
              periodizationEnabled={periodizationEnabled}
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

      {
        showBodyModal && (
          <BodyDataSection
            data={bodyData}
            onUpdate={(newData) => setBodyData(newData)}
            onClose={() => setShowBodyModal(false)}
          />
        )
      }

      {
        showSettings && (
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
            periodizationEnabled={periodizationEnabled}
            setPeriodizationEnabled={setPeriodizationEnabled}
            setShowPeriodizationInfo={setShowPeriodizationInfo}
            bodyData={bodyData}
            setBodyData={setBodyData}
          />
        )
      }

      {
        timerEnd && (
          <Timer
            endTime={timerEnd}
            onClose={() => setTimerEnd(null)}
          />
        )
      }

      {/* Periodization Info Modal */}
      {showPeriodizationInfo && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowPeriodizationInfo(false)}
        >
          <div
            className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 space-y-5 animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">🧠</div>
              <h2 className="text-xl font-black text-slate-800">波動式週期訓練</h2>
            </div>

            <div className="space-y-3 text-[12px] font-bold text-slate-600 leading-relaxed">
              <p>透過 <strong>每週變換訓練重量和次數</strong>，刺激不同肌纖維類型，避免身體適應停滯。</p>

              <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">W1</span>
                  <span><strong>肌肥大</strong>：75% 基準重量 × 8-12 下 × 4 組</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded-full">W2</span>
                  <span><strong>力量週</strong>：基準重量 × 4-6 下 × 4 組</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black bg-green-100 text-green-600 px-2 py-0.5 rounded-full">W3</span>
                  <span><strong>減量週</strong>：50% 基準重量 × 8-10 下 × 2 組</span>
                </div>
              </div>

              <p>W2 力量週做到 <strong>6 下以上</strong>，下個循環會自動增加重量（槓鈴 +5kg、啞鈴/器械 +2.5kg）。</p>
            </div>

            <button
              onClick={() => setShowPeriodizationInfo(false)}
              className="w-full py-4 rounded-2xl font-black text-white bg-indigo-600 shadow-lg"
            >
              了解！
            </button>
          </div>
        </div>
      )}
    </div >
  );
};

export default FitTracker;
