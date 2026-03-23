import { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react';
import { geminiGenerate } from '../../utils/gemini';
import './MeetNote.css';

interface MeetingRecord {
    id: string;
    title: string;
    date: string;
    fileName: string;
    summary: string;
    transcript: string;
    topics: string;
    decisions: string;
    actionItems: string;
    insights: string;
}

type ViewState = 'upload' | 'processing' | 'result';

const MEETING_PROMPT = `你是一位專業的會議記錄助理。請分析這段音檔，並以繁體中文輸出以下格式的會議摘要。

請嚴格按照以下 Markdown 格式輸出，每個區塊用 --- 分隔：

## 📌 議題摘要
- 列出討論的主要議題（3-7 個重點）

---

## ✅ 關鍵決議
- 列出會議中做出的決定

---

## 📝 行動項目
- 列出需要執行的事項，盡可能標註負責人與期限
- 格式：[ ] 任務描述（負責人 / 期限）

---

## 💡 重點觀察
- 列出值得注意的觀點、風險或洞察

---

## 📜 完整逐字稿
將音檔內容完整轉錄為文字，保持原始對話的自然語序。

注意：
- 使用繁體中文
- 保持簡潔專業的語調
- 如果某個區塊沒有內容，寫「無」
- 逐字稿要盡量完整`;

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ACCEPTED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/flac', 'audio/ogg', 'audio/webm'];

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Remove data URL prefix (data:audio/...;base64,)
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function parseSummarySection(fullText: string, sectionName: string): string {
    const regex = new RegExp(`##\\s*${sectionName}[\\s\\S]*?(?=\\n---\\n|\\n##|$)`, 'i');
    const match = fullText.match(regex);
    if (!match) return '';
    // Remove the heading line
    return match[0].replace(/^##\s*.+\n/, '').trim();
}

export default function MeetNote() {
    const [viewState, setViewState] = useState<ViewState>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState('');
    const [transcriptOpen, setTranscriptOpen] = useState(false);

    const [currentRecord, setCurrentRecord] = useState<MeetingRecord | null>(null);
    const [history, setHistory] = useState<MeetingRecord[]>(() => {
        const saved = localStorage.getItem('meetnote_history');
        return saved ? JSON.parse(saved) : [];
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        localStorage.setItem('meetnote_history', JSON.stringify(history));
    }, [history]);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2500);
    };

    const validateFile = (f: File): boolean => {
        if (f.size > MAX_FILE_SIZE) {
            setError(`檔案過大（${formatFileSize(f.size)}），上限 25MB`);
            return false;
        }
        // Be lenient with MIME types since they vary across browsers
        const ext = f.name.toLowerCase().split('.').pop();
        const validExts = ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'webm', 'mp4', 'aac'];
        if (!validExts.includes(ext || '')) {
            setError('不支援的檔案格式，請上傳 MP3/WAV/M4A/FLAC/OGG 音檔');
            return false;
        }
        setError('');
        return true;
    };

    const handleFile = (f: File) => {
        if (validateFile(f)) {
            setFile(f);
        }
    };

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) handleFile(droppedFile);
    };

    const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (selected) handleFile(selected);
        e.target.value = '';
    };

    const processAudio = async () => {
        if (!file) return;

        setViewState('processing');
        setError('');

        try {
            const base64Data = await fileToBase64(file);

            // Determine MIME type
            let mimeType = file.type || 'audio/mpeg';
            if (mimeType === 'audio/x-m4a') mimeType = 'audio/mp4';
            if (!mimeType.startsWith('audio/')) mimeType = 'audio/mpeg';

            const response = await geminiGenerate({
                model: 'gemini-2.5-flash',
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { inlineData: { mimeType, data: base64Data } },
                            { text: MEETING_PROMPT },
                        ],
                    },
                ],
            });

            const fullText = response.text || '';

            const record: MeetingRecord = {
                id: generateId(),
                title: file.name.replace(/\.[^.]+$/, ''),
                date: new Date().toLocaleDateString('zh-TW', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit',
                }),
                fileName: file.name,
                summary: fullText,
                topics: parseSummarySection(fullText, '📌 議題摘要'),
                decisions: parseSummarySection(fullText, '✅ 關鍵決議'),
                actionItems: parseSummarySection(fullText, '📝 行動項目'),
                insights: parseSummarySection(fullText, '💡 重點觀察'),
                transcript: parseSummarySection(fullText, '📜 完整逐字稿'),
            };

            setCurrentRecord(record);
            setHistory(prev => [record, ...prev].slice(0, 10));
            setViewState('result');
        } catch (e: any) {
            console.error(e);
            const msg = e?.message || '';
            if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
                setError('API 額度已用完，請等明日重置或升級付費方案');
            } else if (msg.includes('too large') || msg.includes('size')) {
                setError('音檔太大，Gemini 無法處理。請嘗試較短的錄音');
            } else {
                setError('處理失敗：' + msg.slice(0, 100));
            }
            setViewState('upload');
        }
    };

    const copyMarkdown = () => {
        if (!currentRecord) return;
        navigator.clipboard.writeText(currentRecord.summary);
        showToast('已複製 Markdown ✓');
    };

    const downloadMarkdown = () => {
        if (!currentRecord) return;
        const blob = new Blob([currentRecord.summary], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentRecord.title}_會議摘要.md`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('已下載 .md 檔 ✓');
    };

    const loadRecord = (record: MeetingRecord) => {
        setCurrentRecord(record);
        setTranscriptOpen(false);
        setViewState('result');
    };

    const deleteRecord = (id: string) => {
        setHistory(prev => prev.filter(r => r.id !== id));
        if (currentRecord?.id === id) {
            setCurrentRecord(null);
            setViewState('upload');
        }
    };

    const startNew = () => {
        setFile(null);
        setCurrentRecord(null);
        setError('');
        setTranscriptOpen(false);
        setViewState('upload');
    };

    return (
        <div className="meetnote">
            <h1>🎙️ MeetNote</h1>
            <p className="meetnote-subtitle">上傳會議錄音，AI 自動產生會議摘要</p>

            {/* History */}
            {history.length > 0 && viewState !== 'processing' && (
                <div className="history-list">
                    <h3>📂 過往紀錄</h3>
                    {history.map(record => (
                        <div
                            key={record.id}
                            className={`history-item ${currentRecord?.id === record.id ? 'active' : ''}`}
                            onClick={() => loadRecord(record)}
                        >
                            <span className="history-item-icon">📋</span>
                            <div className="history-item-info">
                                <div className="history-item-title">{record.title}</div>
                                <div className="history-item-date">{record.date}</div>
                            </div>
                            <button
                                className="history-item-delete"
                                onClick={e => { e.stopPropagation(); deleteRecord(record.id); }}
                                title="刪除"
                                aria-label="刪除紀錄"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {viewState === 'result' && (
                <button className="new-meeting-btn" onClick={startNew}>
                    ＋ 新增會議紀錄
                </button>
            )}

            {/* Upload View */}
            {viewState === 'upload' && (
                <>
                    <div
                        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                    >
                        <span className="upload-icon">🎤</span>
                        <h3>拖放音檔或點擊上傳</h3>
                        <p>支援 MP3、WAV、M4A、FLAC、OGG（上限 25MB）</p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".mp3,.wav,.m4a,.flac,.ogg,.webm,.aac"
                            onChange={handleFileInput}
                        />
                    </div>

                    {file && (
                        <>
                            <div className="file-info">
                                <span className="file-info-icon">🎵</span>
                                <div className="file-info-details">
                                    <div className="file-info-name">{file.name}</div>
                                    <div className="file-info-size">{formatFileSize(file.size)}</div>
                                </div>
                                <button
                                    className="file-info-remove"
                                    onClick={() => setFile(null)}
                                    aria-label="移除檔案"
                                >
                                    ✕
                                </button>
                            </div>
                            <button
                                className="process-btn"
                                onClick={processAudio}
                            >
                                🚀 開始分析
                            </button>
                        </>
                    )}

                    {error && <div className="error-message">❌ {error}</div>}
                </>
            )}

            {/* Processing View */}
            {viewState === 'processing' && (
                <div className="processing-state">
                    <div className="processing-spinner" />
                    <h3>Gemini AI 分析中...</h3>
                    <p>正在轉錄音檔並生成會議摘要，請稍候</p>
                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem' }}>
                        約需 30-60 秒，視音檔長度而定
                    </p>
                </div>
            )}

            {/* Result View */}
            {viewState === 'result' && currentRecord && (
                <>
                    <div className="result-header">
                        <h2>📋 {currentRecord.title}</h2>
                        <div className="result-actions">
                            <button onClick={copyMarkdown}>📋 複製</button>
                            <button onClick={downloadMarkdown}>💾 下載 .md</button>
                        </div>
                    </div>

                    {currentRecord.topics && (
                        <div className="summary-section">
                            <h3>📌 議題摘要</h3>
                            <div className="summary-content">{currentRecord.topics}</div>
                        </div>
                    )}

                    {currentRecord.decisions && (
                        <div className="summary-section">
                            <h3>✅ 關鍵決議</h3>
                            <div className="summary-content">{currentRecord.decisions}</div>
                        </div>
                    )}

                    {currentRecord.actionItems && (
                        <div className="summary-section">
                            <h3>📝 行動項目</h3>
                            <div className="summary-content">{currentRecord.actionItems}</div>
                        </div>
                    )}

                    {currentRecord.insights && (
                        <div className="summary-section">
                            <h3>💡 重點觀察</h3>
                            <div className="summary-content">{currentRecord.insights}</div>
                        </div>
                    )}

                    {currentRecord.transcript && (
                        <div className="summary-section">
                            <button
                                className="transcript-toggle"
                                onClick={() => setTranscriptOpen(!transcriptOpen)}
                                aria-expanded={transcriptOpen}
                                aria-controls="transcript-content"
                                aria-label={transcriptOpen ? '收合完整逐字稿' : '展開完整逐字稿'}
                            >
                                <span>📜 完整逐字稿</span>
                                <span>{transcriptOpen ? '收合 ▲' : '展開 ▼'}</span>
                            </button>
                            {transcriptOpen && (
                                <div id="transcript-content" className="transcript-content">{currentRecord.transcript}</div>
                            )}
                        </div>
                    )}
                </>
            )}

            {toast && <div className="toast">{toast}</div>}
        </div>
    );
}
