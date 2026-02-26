
import React, { useState } from 'react';
import { UserBodyData } from '../types';

interface Props {
  data: UserBodyData;
  onUpdate: (data: UserBodyData) => void;
  onClose: () => void;
}

const BodyDataSection: React.FC<Props> = ({ data, onUpdate, onClose }) => {
  const [tempData, setTempData] = useState<UserBodyData>({ ...data });

  const handleUpdate = () => {
    onUpdate(tempData);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 space-y-8 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">📊</span>
          </div>
          <h2 className="text-2xl font-black text-slate-800">更新體態數據</h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">準確的數據有助於計算消耗</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">體重 (kg)</label>
            <input 
              type="number"
              value={tempData.weight}
              onChange={(e) => setTempData({ ...tempData, weight: parseFloat(e.target.value) || 0 })}
              className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-xl font-black text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">身高 (cm)</label>
              <input 
                type="number"
                value={tempData.height}
                onChange={(e) => setTempData({ ...tempData, height: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-xl font-black text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">年齡</label>
              <input 
                type="number"
                value={tempData.age}
                onChange={(e) => setTempData({ ...tempData, age: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-xl font-black text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button 
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl font-black text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleUpdate}
            className="flex-2 bg-indigo-600 text-white py-4 px-8 rounded-2xl font-black text-lg shadow-xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all"
          >
            更新數據
          </button>
        </div>
      </div>
    </div>
  );
};

export default BodyDataSection;
