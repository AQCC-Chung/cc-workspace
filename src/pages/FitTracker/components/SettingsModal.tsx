
import React, { useRef, useState } from 'react';
import { testGeminiConnection } from '../../../utils/gemini';

interface Props {
  userEmail: string;
  setUserEmail: (email: string) => void;
  onClose: () => void;
  onDownload: () => void;
  onEmailBackup: () => void;
  onImport: (file: File) => void;
  isSyncing: boolean;
  hasEmailConfig: boolean;
  ttsEnabled: boolean;
  setTtsEnabled: (v: boolean) => void;
  periodizationEnabled: boolean;
  setPeriodizationEnabled: (v: boolean) => void;
  setShowPeriodizationInfo: (v: boolean) => void;
  bodyData: { weight: number; height: number; age: number };
  setBodyData: (data: { weight: number; height: number; age: number }) => void;
}

const SettingsModal: React.FC<Props> = ({
  userEmail,
  setUserEmail,
  onClose,
  onDownload,
  onEmailBackup,
  onImport,
  isSyncing,
  hasEmailConfig,
  ttsEnabled,
  setTtsEnabled,
  periodizationEnabled,
  setPeriodizationEnabled,
  setShowPeriodizationInfo,
  bodyData,
  setBodyData,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [quotaStatus, setQuotaStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [quotaMsg, setQuotaMsg] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      e.target.value = '';
    }
  };

  const checkGeminiQuota = async () => {
    setQuotaStatus('checking');
    const result = await testGeminiConnection();

    if (result.status === 'ok') {
      setQuotaStatus('ok');
      setQuotaMsg(result.message);
    } else {
      setQuotaStatus('error');
      setQuotaMsg(result.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div
        className="bg-slate-50 w-full max-w-md h-[90vh] sm:h-auto sm:max-h-[90vh] rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl p-6 sm:p-8 space-y-4 overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-2 px-2">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">設定</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center hover:bg-slate-300 hover:text-slate-700 transition-colors">
            <span className="sr-only">關閉</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* General Settings */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">AI 功能</p>

          {/* TTS Toggle */}
          <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl">
            <div className="flex items-center gap-3">
              <span className="text-lg">🔊</span>
              <div>
                <p className="text-xs font-black text-slate-700">語音激勵</p>
                <p className="text-[10px] text-slate-400">每組完成後播放 AI 語音</p>
              </div>
            </div>
            <button
              onClick={() => setTtsEnabled(!ttsEnabled)}
              className={`w-12 h-7 rounded-full transition-all relative ${ttsEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
              role="switch"
              aria-checked={ttsEnabled}
              aria-label="語音激勵"
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-1 transition-all ${ttsEnabled ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          {/* Quota Check */}
          <button
            onClick={checkGeminiQuota}
            disabled={quotaStatus === 'checking'}
            className="w-full flex items-center gap-3 p-4 bg-purple-50 rounded-2xl hover:bg-purple-100 transition-all disabled:opacity-50"
          >
            <span className="text-lg">{quotaStatus === 'checking' ? '⏳' : quotaStatus === 'ok' ? '✅' : quotaStatus === 'error' ? '❌' : '🔑'}</span>
            <div className="text-left flex-1">
              <p className="text-xs font-black text-purple-700">
                {quotaStatus === 'checking' ? '測試中...' : '測試 Gemini API 連線'}
              </p>
              <p className="text-[10px] text-purple-400">
                {quotaMsg || '確認 API Key 有效且有剩餘額度'}
              </p>
            </div>
          </button>
          {quotaStatus === 'ok' && (
            <p className="text-[10px] font-black text-emerald-600 ml-1">✅ {quotaMsg}</p>
          )}
          {quotaStatus === 'error' && (
            <p className="text-[10px] font-black text-red-500 ml-1">❌ {quotaMsg}</p>
          )}

          {/* Periodization Toggle */}
          <div className="flex items-center justify-between p-1 mt-4">
            <div className="flex items-center gap-3">
              <span className="text-xl">🧠</span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black text-slate-800">Smart Coach 週期</p>
                  <button
                    onClick={() => {
                      setShowPeriodizationInfo(true);
                    }}
                    className="w-4 h-4 bg-slate-200 rounded-full text-[8px] font-black text-slate-500 flex items-center justify-center hover:bg-slate-300 transition-colors"
                  >?</button>
                </div>
                <p className="text-[10px] text-slate-500">自動變換訓練重量和次數</p>
              </div>
            </div>
            <button
              onClick={() => setPeriodizationEnabled(!periodizationEnabled)}
              className={`w-12 h-7 rounded-full transition-all relative ${periodizationEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
              role="switch"
              aria-checked={periodizationEnabled}
              aria-label="Smart Coach 週期"
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-1 transition-all ${periodizationEnabled ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </div>

        {/* Body Data Section */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-3">
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">體態數據</p>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">體重 (kg)</label>
              <input
                type="number"
                value={bodyData.weight || ''}
                onChange={(e) => setBodyData({ ...bodyData, weight: Number(e.target.value) })}
                className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-2xl text-sm font-black text-slate-700 focus:outline-none focus:border-indigo-500 transition-all text-center"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">身高 (cm)</label>
              <input
                type="number"
                value={bodyData.height || ''}
                onChange={(e) => setBodyData({ ...bodyData, height: Number(e.target.value) })}
                className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-2xl text-sm font-black text-slate-700 focus:outline-none focus:border-indigo-500 transition-all text-center"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">年齡 (y)</label>
              <input
                type="number"
                value={bodyData.age || ''}
                onChange={(e) => setBodyData({ ...bodyData, age: Number(e.target.value) })}
                className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-2xl text-sm font-black text-slate-700 focus:outline-none focus:border-indigo-500 transition-all text-center"
              />
            </div>
          </div>
        </div>

        {/* Data Section */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-3">
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">資料管理</p>

          <button
            onClick={onDownload}
            className="w-full flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl hover:bg-indigo-100 transition-all"
          >
            <span className="text-lg">📥</span>
            <div className="text-left">
              <span className="text-xs font-black text-indigo-700 block">下載備份檔</span>
              <span className="text-[10px] text-indigo-400">匯出 JSON 到裝置</span>
            </div>
          </button>

          <div className="space-y-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email 地址</label>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="your@gmail.com"
                className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-2xl text-xs font-bold text-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
            <button
              disabled={isSyncing || !userEmail || !hasEmailConfig}
              onClick={onEmailBackup}
              className="w-full flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl hover:bg-emerald-100 transition-all disabled:opacity-40"
            >
              <span className="text-lg">📧</span>
              <div className="text-left">
                <span className="text-xs font-black text-emerald-700 block">
                  {isSyncing ? '寄送中...' : 'Email 備份'}
                </span>
                <span className="text-[10px] text-emerald-400">
                  {hasEmailConfig ? '寄送備份到你的信箱' : '備份 API 尚未設定'}
                </span>
              </div>
            </button>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-3 p-4 bg-amber-50 rounded-2xl hover:bg-amber-100 transition-all"
          >
            <span className="text-lg">📤</span>
            <div className="text-left">
              <span className="text-xs font-black text-amber-700 block">匯入資料</span>
              <span className="text-[10px] text-amber-400">從 JSON 備份檔還原</span>
            </div>
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;
