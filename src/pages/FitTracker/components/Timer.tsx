
import React, { useState, useEffect } from 'react';

interface Props {
  endTime: number;
  onClose: () => void;
}

const Timer: React.FC<Props> = ({ endTime, onClose }) => {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        // Simple notification sound or feedback could be here
        setTimeout(onClose, 2000);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [endTime, onClose]);

  const progress = (timeLeft / 90) * 100;

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-in zoom-in slide-in-from-bottom-10">
      <div className="bg-slate-900 text-white p-4 rounded-3xl shadow-2xl flex items-center gap-4 border border-slate-700 min-w-[180px]">
        <div className="relative w-12 h-12">
          <svg className="w-full h-full -rotate-90">
            <circle cx="24" cy="24" r="20" className="fill-none stroke-slate-700 stroke-4" />
            <circle 
              cx="24" cy="24" r="20" 
              className="fill-none stroke-indigo-500 stroke-4 transition-all duration-1000"
              strokeDasharray="125.6"
              strokeDashoffset={125.6 - (125.6 * progress) / 100}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">
            {timeLeft}s
          </span>
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase text-slate-400">組間休息</p>
          <p className="text-sm font-black leading-none">
            {timeLeft > 0 ? '喘口氣，休息一下...' : '開始下一組！'}
          </p>
        </div>
        <button 
          onClick={onClose}
          className="p-1 text-slate-500 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default Timer;
