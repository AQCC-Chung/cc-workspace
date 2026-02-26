
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
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-sm max-h-[90vh] rounded-[2.5rem] shadow-2xl p-8 space-y-5 animate-in zoom-in-95 duration-200 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">⚙️</div>
          <h2 className="text-xl font-black text-slate-800">設定</h2>
        </div>

        {/* AI Features Section */}
        <div className="space-y-3">
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
          <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl mt-4">
            <div className="flex items-center gap-3">
              <span className="text-lg">🧠</span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-black text-slate-700">Smart Coach 週期</p>
                  <button
                    onClick={() => {
                      onClose(); // Optional: close settings when opening info
                      setShowPeriodizationInfo(true);
                    }}
                    className="w-4 h-4 bg-slate-200 rounded-full text-[8px] font-black text-slate-500 flex items-center justify-center"
                  >?</button>
                </div>
                <p className="text-[10px] text-slate-400">自動變換訓練重量和次數</p>
              </div>
            </div>
            <button
              onClick={() => setPeriodizationEnabled(!periodizationEnabled)}
              className={`w-12 h-7 rounded-full transition-all relative ${periodizationEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow absolute top-1 transition-all ${periodizationEnabled ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </div>

        {/* Body Data Section */}
        <div className="space-y-3 pt-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">體態數據</p>

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
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">資料管理</p>

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
                  {hasEmailConfig ? '寄送備份到你的信箱' : 'EmailJS 尚未設定'}
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

        <button
          onClick={onClose}
          className="w-full py-4 rounded-2xl font-black text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
        >
          完成
        </button>
      </div>
    </div>
  );
};

export default SettingsModal;
