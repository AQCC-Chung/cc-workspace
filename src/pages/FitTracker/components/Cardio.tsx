
import React, { useState, useMemo } from 'react';
import { CardioRecord } from '../types';
import { CARDIO_EQUIPMENT } from '../constants';
import { getTodayDateString, calculateExerciseKcal } from '../utils';

interface Props {
  weight: number;
  records: CardioRecord[];
  setRecords: React.Dispatch<React.SetStateAction<CardioRecord[]>>;
}

const Cardio: React.FC<Props> = ({ weight, records, setRecords }) => {
  const [selectedMachine, setSelectedMachine] = useState(CARDIO_EQUIPMENT[0]);
  const [duration, setDuration] = useState(20);
  const [kcal, setKcal] = useState<string>('');
  const [distance, setDistance] = useState<string>('');
  const [hr, setHr] = useState<string>('');
  const [speed, setSpeed] = useState<string>('');
  const [incline, setIncline] = useState<string>('');

  const todayRecords = useMemo(() => 
    records.filter(r => r.date === getTodayDateString()), 
    [records]
  );

  const handleAddCardio = () => {
    const newRecord: CardioRecord = {
      id: Math.random().toString(36).substr(2, 9),
      date: getTodayDateString(),
      machine: selectedMachine.name,
      duration,
      kcal: kcal ? parseFloat(kcal) : calculateExerciseKcal(selectedMachine.met, weight, duration),
      distance: distance ? parseFloat(distance) : undefined,
      heartRate: hr ? parseInt(hr) : undefined,
      speed: speed ? parseFloat(speed) : undefined,
      incline: incline ? parseFloat(incline) : undefined
    };

    setRecords(prev => [...prev, newRecord]);
    // Reset inputs
    setKcal('');
    setDistance('');
    setHr('');
    setSpeed('');
    setIncline('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
        <h2 className="text-lg font-bold text-slate-800">有氧運動紀錄</h2>
        
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-400 uppercase">選擇器材</label>
          <div className="grid grid-cols-2 gap-2">
            {CARDIO_EQUIPMENT.map(m => (
              <button
                key={m.name}
                onClick={() => setSelectedMachine(m)}
                className={`p-3 rounded-xl text-sm font-bold border transition-all ${
                  selectedMachine.name === m.name 
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                    : 'bg-slate-50 border-slate-100 text-slate-600 hover:border-indigo-300'
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-400 uppercase">運動時長 (分鐘)</label>
          <input 
            type="number" 
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
            className="w-full bg-slate-50 p-4 rounded-xl text-2xl font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">器材顯示消耗 (選填)</label>
            <input 
              placeholder="例如 150"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              className="w-full bg-slate-100 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">距離 (公里 KM)</label>
            <input 
              placeholder="例如 2.5"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="w-full bg-slate-100 p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {selectedMachine.name === '跑步機' && (
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 grid grid-cols-2 gap-4">
             <div className="space-y-1">
                <label className="text-[10px] font-bold text-blue-400 uppercase">速度 (KM/H)</label>
                <input 
                  placeholder="6.5"
                  value={speed}
                  onChange={(e) => setSpeed(e.target.value)}
                  className="w-full bg-white p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-blue-400 uppercase">坡度 (%)</label>
                <input 
                  placeholder="3.0"
                  value={incline}
                  onChange={(e) => setIncline(e.target.value)}
                  className="w-full bg-white p-2 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500"
                />
              </div>
          </div>
        )}

        <button 
          onClick={handleAddCardio}
          className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-indigo-700 transition-all"
        >
          儲存有氧紀錄
        </button>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase px-1">今日有氧明細 ({todayRecords.length})</h3>
        {todayRecords.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl border-2 border-dashed border-slate-200 text-center text-slate-400 font-medium italic">
            今日尚無有氧運動紀錄。
          </div>
        ) : (
          todayRecords.map(record => (
            <div key={record.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center">
              <div>
                <p className="font-bold text-slate-700">{record.machine}</p>
                <p className="text-xs text-slate-400">{record.duration} 分鐘 • 約 {Math.round(record.kcal || 0)} kcal</p>
              </div>
              <div className="text-right">
                {record.distance && <p className="text-sm font-bold text-indigo-500">{record.distance} KM</p>}
                {record.heartRate && <p className="text-[10px] font-bold text-slate-400">{record.heartRate} BPM</p>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Cardio;
