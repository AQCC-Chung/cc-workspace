
import React, { useRef } from 'react';

interface Props {
  userEmail: string;
  setUserEmail: (email: string) => void;
  onClose: () => void;
  onDownload: () => void;
  onEmailBackup: () => void;
  onImport: (file: File) => void;
  isSyncing: boolean;
  hasEmailConfig: boolean;
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
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
      e.target.value = '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 space-y-6 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            💾
          </div>
          <h2 className="text-2xl font-black text-slate-800">資料管理</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            匯出、備份、匯入你的健身紀錄
          </p>
        </div>

        {/* Download */}
        <button
          onClick={onDownload}
          className="w-full flex items-center gap-4 p-4 bg-indigo-50 rounded-2xl hover:bg-indigo-100 transition-all group"
        >
          <span className="text-2xl group-active:scale-125 transition-transform">📥</span>
          <div className="text-left">
            <span className="text-sm font-black text-indigo-700 block">下載備份檔</span>
            <span className="text-[10px] text-indigo-400">匯出 JSON 到裝置</span>
          </div>
        </button>

        {/* Email */}
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              Email 地址
            </label>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="your@gmail.com"
              className="w-full bg-slate-50 border-2 border-slate-100 p-3.5 rounded-2xl text-xs font-bold text-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>
          <button
            disabled={isSyncing || !userEmail || !hasEmailConfig}
            onClick={onEmailBackup}
            className="w-full flex items-center gap-4 p-4 bg-emerald-50 rounded-2xl hover:bg-emerald-100 transition-all disabled:opacity-40 group"
          >
            <span className="text-2xl group-active:scale-125 transition-transform">📧</span>
            <div className="text-left">
              <span className="text-sm font-black text-emerald-700 block">
                {isSyncing ? '寄送中...' : 'Email 備份'}
              </span>
              <span className="text-[10px] text-emerald-400">
                {hasEmailConfig ? '寄送備份到你的信箱' : 'EmailJS 尚未設定'}
              </span>
            </div>
          </button>
        </div>

        {/* Import */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center gap-4 p-4 bg-amber-50 rounded-2xl hover:bg-amber-100 transition-all group"
        >
          <span className="text-2xl group-active:scale-125 transition-transform">📤</span>
          <div className="text-left">
            <span className="text-sm font-black text-amber-700 block">匯入資料</span>
            <span className="text-[10px] text-amber-400">從 JSON 備份檔還原</span>
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Close */}
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
