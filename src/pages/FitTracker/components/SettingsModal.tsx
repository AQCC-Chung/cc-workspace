
import React from 'react';

interface Props {
  url: string;
  setUrl: (url: string) => void;
  onClose: () => void;
  onSync: (mode: 'UPLOAD' | 'DOWNLOAD') => void;
  isSyncing: boolean;
}

const SettingsModal: React.FC<Props> = ({ url, setUrl, onClose, onSync, isSyncing }) => {
  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 space-y-8 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            ☁️
          </div>
          <h2 className="text-2xl font-black text-slate-800">雲端同步設定</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">連結 Google Sheets 儲存資料</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">GAS Web App URL</label>
            <input 
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://script.google.com/..."
              className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-xs font-bold text-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4">
            <button 
              disabled={isSyncing || !url}
              onClick={() => onSync('UPLOAD')}
              className="flex flex-col items-center gap-2 p-4 bg-indigo-50 rounded-2xl hover:bg-indigo-100 transition-all disabled:opacity-50 group"
            >
              <span className="text-xl group-active:scale-125 transition-transform">📤</span>
              <span className="text-[10px] font-black text-indigo-600 uppercase">上傳備份</span>
            </button>
            <button 
              disabled={isSyncing || !url}
              onClick={() => onSync('DOWNLOAD')}
              className="flex flex-col items-center gap-2 p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all disabled:opacity-50 group"
            >
              <span className="text-xl group-active:scale-125 transition-transform">📥</span>
              <span className="text-[10px] font-black text-slate-600 uppercase">下載恢復</span>
            </button>
          </div>
        </div>

        <div className="pt-4">
          <button 
            onClick={onClose}
            className="w-full py-4 rounded-2xl font-black text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            完成
          </button>
        </div>

        <p className="text-[9px] text-slate-300 text-center leading-relaxed">
          請確保 GAS 腳本已部署為「網頁應用程式」<br/>且存取權限設為「任何人」。
        </p>
      </div>
    </div>
  );
};

export default SettingsModal;
