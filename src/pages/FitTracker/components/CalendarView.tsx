
import React, { useState } from 'react';
import { WeightWorkoutSession, CardioRecord, Exercise } from '../types';

interface Props {
  weightSessions: WeightWorkoutSession[];
  cardioRecords: CardioRecord[];
  exercises: Exercise[];
}

const CalendarView: React.FC<Props> = ({ weightSessions, cardioRecords, exercises }) => {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

  const monthName = viewDate.toLocaleString('zh-TW', { month: 'long', year: 'numeric' });

  const getDayData = (day: number) => {
    const dateStr = `${viewDate.getFullYear()}-${(viewDate.getMonth() + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const weightCount = weightSessions.filter(s => s.date === dateStr).length;
    const cardioCount = cardioRecords.filter(r => r.date === dateStr).length;
    return { dateStr, weightCount, cardioCount };
  };

  const handleDayClick = (dayStr: string) => {
    setSelectedDay(dayStr);
  };

  const selectedData = selectedDay ? {
    weight: weightSessions.filter(s => s.date === selectedDay),
    cardio: cardioRecords.filter(r => r.date === selectedDay)
  } : null;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))} className="p-2 hover:bg-slate-100 rounded-full">◀</button>
          <h2 className="text-lg font-bold text-slate-800">{monthName}</h2>
          <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))} className="p-2 hover:bg-slate-100 rounded-full">▶</button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {['日', '一', '二', '三', '四', '五', '六'].map(d => (
            <div key={d} className="text-[10px] font-bold text-slate-400">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const { dateStr, weightCount, cardioCount } = getDayData(day);
            const hasData = weightCount > 0 || cardioCount > 0;
            return (
              <button
                key={day}
                onClick={() => handleDayClick(dateStr)}
                className={`aspect-square flex flex-col items-center justify-center rounded-lg relative ${
                  selectedDay === dateStr ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-50'
                }`}
              >
                <span className="text-sm font-bold">{day}</span>
                {hasData && (
                  <div className="flex gap-0.5 mt-1">
                    {weightCount > 0 && <div className={`w-1 h-1 rounded-full ${selectedDay === dateStr ? 'bg-white' : 'bg-indigo-500'}`} />}
                    {cardioCount > 0 && <div className={`w-1 h-1 rounded-full ${selectedDay === dateStr ? 'bg-white' : 'bg-blue-400'}`} />}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay && selectedData && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6 animate-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center">
             <h3 className="font-bold text-slate-800">{selectedDay} 訓練明細</h3>
             <button onClick={() => setSelectedDay(null)} className="text-xs text-slate-400 font-bold">關閉</button>
          </div>
          
          <div className="space-y-4">
            {selectedData.weight.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">重量訓練內容</p>
                {selectedData.weight.map(s => {
                  const ex = exercises.find(e => e.id === s.exerciseId);
                  return (
                    <div key={s.id} className="p-3 bg-indigo-50 rounded-xl">
                      <p className="text-sm font-bold text-indigo-700">{ex?.name || '未知動作'}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {s.sets.map((st, i) => (
                          <span key={i} className="text-[10px] bg-white px-2 py-0.5 rounded shadow-sm text-slate-500">
                            {st.weight}kg × {st.reps} 次
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedData.cardio.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">有氧運動內容</p>
                {selectedData.cardio.map(r => (
                  <div key={r.id} className="p-3 bg-blue-50 rounded-xl flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-blue-700">{r.machine}</p>
                      <p className="text-[10px] text-blue-400">{r.duration} 分鐘 • {Math.round(r.kcal || 0)} kcal</p>
                    </div>
                    {r.distance && <span className="text-xs font-bold text-blue-600">{r.distance} KM</span>}
                  </div>
                ))}
              </div>
            )}

            {selectedData.weight.length === 0 && selectedData.cardio.length === 0 && (
               <p className="text-sm text-slate-400 italic py-4 text-center">休息日 - 尚無活動紀錄。</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarView;
