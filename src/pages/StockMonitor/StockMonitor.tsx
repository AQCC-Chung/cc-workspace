import { useState, useEffect, useRef, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ComposedChart, Bar, Cell,
} from 'recharts'
import type { WatchlistItem, TickerResult, ScanResponse, ChartPoint, NewsItem, SectorStat } from './types'
import './StockMonitor.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const STORAGE_KEY = 'stockMonitor_watchlist'
const HISTORY_KEY = 'stockMonitor_history'

// ── 台股名稱（前端備份，掃描結果會覆蓋）────────────────
const TW_NAMES: Record<string, string> = {
  '0050': '元大台灣50', '0056': '元大高股息',
  '2330': '台積電',  '2454': '聯發科',  '3711': '日月光投控',
  '3034': '聯詠',    '2344': '華邦電',  '3008': '大立光',
  '6488': '環球晶',  '2337': '旺宏',    '6415': '矽力-KY',
  '2317': '鴻海',    '2382': '廣達',    '2357': '華碩',
  '4938': '和碩',    '2376': '技嘉',    '2377': '微星',
  '3231': '緯創',    '2353': '宏碁',    '2308': '台達電',
  '2301': '光寶科',  '2395': '研華',    '2379': '瑞昱',
  '6669': '緯穎',    '2474': '可成',    '3702': '大聯大',
  '2412': '中華電',  '3045': '台灣大',  '4904': '遠傳',
  '2882': '國泰金',  '2881': '富邦金',  '2886': '兆豐金',
  '2891': '中信金',  '2892': '第一金',  '2884': '玉山金',
  '2885': '元大金',  '5880': '合庫金',  '1301': '台塑',
  '1303': '南亞',    '1326': '台化',    '6505': '台塑化',
  '1101': '台泥',    '1102': '亞泥',    '2002': '中鋼',
  '2603': '長榮',    '2609': '陽明',    '2615': '萬海',
  '2912': '統一超',  '2207': '和泰車',  '1216': '統一',
}

// ── 訊號 class 映射 ────────────────────────────────────
const SIGNAL_CLASS: Record<string, string> = {
  '滿分買進': 'signal-buy',
  '強烈買進': 'signal-buy2',
  '強烈賣出': 'signal-sell',
  '九轉買點': 'signal-nine',
  '九轉賣點': 'signal-nine',
  '波段起漲': 'signal-trend',
  '波段轉弱': 'signal-trend-down',
  '動能噴發': 'signal-macd',
  '支撐確認': 'signal-vwap',
  '系統性風險：暫停買入': 'signal-risk',
  '觀察中': 'signal-neutral',
}

const SIGNAL_ICON: Record<string, string> = {
  '滿分買進': '★ ',
  '強烈買進': '▲ ',
  '強烈賣出': '⚠ ',
  '九轉買點': '9 ',
  '九轉賣點': '9 ',
  '波段起漲': '↗ ',
  '波段轉弱': '↘ ',
  '動能噴發': '⚡ ',
  '支撐確認': '⊕ ',
}

interface ScanHistory {
  timestamp: string
  results: TickerResult[]
}

type SortKey = 'score' | 'rsi' | 'zscore' | 'td_count' | 'rr_ratio' | 'pnl' | null

interface ScreenerResponse {
  results: TickerResult[]
  total_scanned: number
  scanned_at: string
}

// ── 持久化 ──────────────────────────────────────────
function loadWatchlist(): WatchlistItem[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}
function saveWatchlist(list: WatchlistItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}
function loadHistory(): ScanHistory[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') }
  catch { return [] }
}

// ── P&L 計算 ─────────────────────────────────────────
function pnlPct(close: number, entry: number): number {
  if (entry === 0) return 0
  const gross = (close - entry) / entry
  return Math.round((gross - 0.003 - 0.001425 * 2) * 10000) / 100
}

// ── 圖表指標計算 ──────────────────────────────────────
function calcEMA(prices: number[], span: number): number[] {
  const k = 2 / (span + 1)
  const out: number[] = []
  let ema = prices[0]
  for (const p of prices) { ema = (p - ema) * k + ema; out.push(ema) }
  return out
}

function calcRSI(prices: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = Array(prices.length).fill(null)
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i < prices.length; i++) {
    const ch = prices[i] - prices[i - 1]
    const g = ch > 0 ? ch : 0
    const l = ch < 0 ? -ch : 0
    if (i < period) { avgGain += g; avgLoss += l }
    else if (i === period) { avgGain = (avgGain + g) / period; avgLoss = (avgLoss + l) / period }
    else { avgGain = (avgGain * (period - 1) + g) / period; avgLoss = (avgLoss * (period - 1) + l) / period }
    if (i >= period) out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return out
}

function calcATR(high: number[], low: number[], close: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = Array(high.length).fill(null)
  let atr = 0
  for (let i = 1; i < high.length; i++) {
    const tr = Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]))
    if (i < period) { atr += tr }
    else if (i === period) { atr = (atr + tr) / period; out[i] = atr }
    else { atr = (atr * (period - 1) + tr) / period; out[i] = atr }
  }
  return out
}

function calcBB(prices: number[], period = 20, mult = 2) {
  return prices.map((_, i) => {
    if (i < period - 1) return { bb_upper: null as number | null, bb_mid: null as number | null, bb_lower: null as number | null }
    const slice = prices.slice(i - period + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const std = Math.sqrt(slice.reduce((s, p) => s + (p - mean) ** 2, 0) / period)
    return {
      bb_upper: +(mean + mult * std).toFixed(2),
      bb_mid: +mean.toFixed(2),
      bb_lower: +(mean - mult * std).toFixed(2),
    }
  })
}

function fmtCountdown(secs: number): string {
  const m = Math.floor(secs / 60)
  return `${m}:${String(secs % 60).padStart(2, '0')}`
}

// ── 蠟燭圖 Shape ─────────────────────────────────────
function CandleShape(props: any) {
  const { x, y, width, height, payload } = props
  if (!payload || !width) return null
  const { open, high, low, close } = payload
  const range = high - low
  const isUp = close >= open
  const color = isUp ? '#ef4444' : '#22c55e'  // 台股：紅漲綠跌
  const cx = x + width / 2
  const bw = Math.max(2, Math.min(width * 0.75, 12))
  if (range === 0 || height <= 0) {
    return <line x1={cx - bw / 2} y1={y} x2={cx + bw / 2} y2={y} stroke={color} strokeWidth={1.5} />
  }
  const openPx = y + (high - open) / range * height
  const closePx = y + (high - close) / range * height
  const bodyTop = Math.min(openPx, closePx)
  const bodyH = Math.max(1.5, Math.abs(closePx - openPx))
  return (
    <g>
      <line x1={cx} y1={y} x2={cx} y2={y + height} stroke={color} strokeWidth={1} opacity={0.8} />
      <rect x={cx - bw / 2} y={bodyTop} width={bw} height={bodyH}
        fill={color} stroke={color} strokeWidth={0.5} fillOpacity={0.95} />
    </g>
  )
}

// ── 新增/編輯 Modal ───────────────────────────────────
interface EditModalProps {
  initial: WatchlistItem | null
  onSave: (item: WatchlistItem) => void
  onClose: () => void
}

function EditModal({ initial, onSave, onClose }: EditModalProps) {
  const [ticker, setTicker] = useState(initial?.ticker ?? '')
  const [price, setPrice] = useState(initial?.entryPrice ? String(initial.entryPrice) : '')
  const [shares, setShares] = useState(initial?.shares ? String(initial.shares) : '')
  const tickerRef = useRef<HTMLInputElement>(null)
  useEffect(() => { tickerRef.current?.focus() }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const t = ticker.trim()
    if (!t) return
    onSave({ ticker: t, entryPrice: parseFloat(price) || 0, shares: parseFloat(shares) || 0 })
  }

  return (
    <div className="sm-modal-overlay" onClick={onClose}>
      <div className="sm-modal" onClick={e => e.stopPropagation()}>
        <h3>{initial ? '編輯持倉' : '新增標的'}</h3>
        <form onSubmit={handleSubmit}>
          <label>股票代號
            <input ref={tickerRef} value={ticker} onChange={e => setTicker(e.target.value)}
              placeholder="如 2330" disabled={!!initial} />
          </label>
          <label>成本價（元）
            <input type="number" value={price} onChange={e => setPrice(e.target.value)}
              placeholder="0 = 未設定" min="0" step="0.01" />
          </label>
          <label>持倉張數
            <input type="number" value={shares} onChange={e => setShares(e.target.value)}
              placeholder="可輸入小數，如 0.5、1.3" min="0" step="any" />
          </label>
          <div className="sm-modal-actions">
            <button type="button" className="sm-btn sm-btn-ghost" onClick={onClose}>取消</button>
            <button type="submit" className="sm-btn sm-btn-primary">儲存</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── K 線圖 Panel ──────────────────────────────────────
type Interval = '1d' | '1h' | '1m'
const MAX_CANDLES = 300

interface ChartPanelProps {
  ticker: string
  entryPrice?: number
  signal?: string
  score?: number | null
  onClose: () => void
}

function ChartPanel({ ticker, entryPrice, signal, score, onClose }: ChartPanelProps) {
  const sectionRef = useRef<HTMLElement>(null)
  useEffect(() => {
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [ticker])
  const [interval, setInterval] = useState<Interval>('1d')
  const [rawData, setRawData] = useState<ChartPoint[]>([])
  const [chartName, setChartName] = useState<string>(TW_NAMES[ticker] ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showBB, setShowBB] = useState(true)
  const [anchorMode, setAnchorMode] = useState(false)
  const [customAnchorIdx, setCustomAnchorIdx] = useState<number | null>(null)
  const [zoomRange, setZoomRange] = useState<number | null>(null)
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [newsSummary, setNewsSummary] = useState<string | null>(null)
  const [newsSector, setNewsSector] = useState<string>('')
  const [newsIndustry, setNewsIndustry] = useState<string>('')
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsError, setNewsError] = useState<string | null>(null)
  const [newsVisible, setNewsVisible] = useState(false)
  const [sectorData, setSectorData] = useState<SectorStat[]>([])
  const [sectorLoading, setSectorLoading] = useState(false)
  const [sectorVisible, setSectorVisible] = useState(false)

  // Reset news when ticker changes
  useEffect(() => {
    setNewsItems([]); setNewsSummary(null); setNewsSector(''); setNewsIndustry('')
    setNewsError(null); setNewsVisible(false); setSectorData([]); setSectorVisible(false)
  }, [ticker])

  function fetchNews() {
    setNewsLoading(true); setNewsError(null); setNewsVisible(true)
    fetch(`${API_BASE}/api/stock/news/${ticker}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => {
        setNewsItems(d.news ?? [])
        setNewsSummary(d.summary ?? null)
        setNewsSector(d.sector ?? '')
        setNewsIndustry(d.industry ?? '')
        if (d.error && (d.news ?? []).length === 0) setNewsError(d.error)
        setNewsLoading(false)
      })
      .catch(e => { setNewsError(e.message); setNewsLoading(false) })
  }

  function fetchSectorOverview() {
    setSectorLoading(true); setSectorVisible(true)
    fetch(`${API_BASE}/api/stock/sector-overview`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { setSectorData(d.sectors ?? []); setSectorLoading(false) })
      .catch(() => setSectorLoading(false))
  }

  // Reset on ticker/interval change
  useEffect(() => {
    setCustomAnchorIdx(null); setAnchorMode(false); setZoomRange(null)
  }, [ticker, interval])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 70000)
    setLoading(true); setError(null)
    fetch(`${API_BASE}/api/stock/chart/${ticker}?interval=${interval}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { if (!cancelled) { setRawData(d.data ?? []); if (d.name) setChartName(d.name); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.name === 'AbortError' ? '伺服器無回應（逾時），請稍後再試' : e.message); setLoading(false) } })
    return () => { cancelled = true; clearTimeout(timeoutId); controller.abort() }
  }, [ticker, interval])

  const processed = useMemo(() => {
    if (rawData.length === 0) return []
    const prices = rawData.map(d => d.price ?? 0)
    const highs = rawData.map(d => d.high ?? d.price ?? 0)
    const lows = rawData.map(d => d.low ?? d.price ?? 0)
    const volumes = rawData.map(d => d.volume)

    const ema8 = calcEMA(prices, 8)
    const ema21 = calcEMA(prices, 21)
    const ema55 = calcEMA(prices, 55)
    const ema12 = calcEMA(prices, 12)
    const ema26 = calcEMA(prices, 26)
    const macdLine = ema12.map((v, i) => v - ema26[i])
    const signalLine = calcEMA(macdLine, 9)
    const macdHist = macdLine.map((v, i) => v - signalLine[i])
    const rsiArr = calcRSI(prices, 14)
    const atrArr = calcATR(highs, lows, prices, 14)
    const bbArr = calcBB(prices, 20, 2)

    // AVWAP anchor
    const lookback = Math.min(60, rawData.length)
    let lowestLow = Infinity, autoAnchorIdx = 0
    for (let i = rawData.length - lookback; i < rawData.length; i++) {
      if (lows[i] < lowestLow) { lowestLow = lows[i]; autoAnchorIdx = i }
    }
    const anchorIdx = customAnchorIdx !== null ? customAnchorIdx : autoAnchorIdx
    let cumVol = 0, cumVP = 0
    const avwapArr = rawData.map((d, i) => {
      if (i < anchorIdx) return null
      const tp = ((d.high ?? d.price ?? 0) + (d.low ?? d.price ?? 0) + (d.price ?? 0)) / 3
      cumVol += volumes[i]; cumVP += tp * volumes[i]
      return cumVol === 0 ? d.price : cumVP / cumVol
    })

    // POC：將每根 K 棒的成交量均勻分攤到 High～Low 各箱子
    const pocData = rawData.slice(anchorIdx)
    const bins: Record<number, number> = {}
    pocData.forEach(d => {
      const h = d.high ?? d.price ?? 0
      const l = d.low ?? d.price ?? 0
      const v = d.volume
      const bs = (d.price ?? 0) > 100 ? 1 : 0.5
      const loB = Math.ceil(l / bs) * bs
      const hiB = Math.floor(h / bs) * bs
      const count = Math.round((hiB - loB) / bs) + 1
      const volPerBin = count > 0 ? v / count : v
      for (let price = loB; price <= hiB + bs * 0.01; price += bs) {
        const bin = +price.toFixed(2)
        bins[bin] = (bins[bin] || 0) + volPerBin
      }
    })
    let maxVol = 0, pocPrice = 0
    for (const [bin, vol] of Object.entries(bins)) {
      if (vol > maxVol) { maxVol = vol; pocPrice = +bin }
    }

    const rsArr = rawData.map(d =>
      d.marketClose && d.marketClose > 0 ? (d.price ?? 0) / d.marketClose * 100 : null
    )

    return rawData.map((d, i) => ({
      ...d,
      ema8: i >= 7 ? +ema8[i].toFixed(2) : null,
      ema21: i >= 20 ? +ema21[i].toFixed(2) : null,
      ema55: i >= 54 ? +ema55[i].toFixed(2) : null,
      macdHist: +macdHist[i].toFixed(3),
      macdLine: +macdLine[i].toFixed(3),
      macdSignal: +signalLine[i].toFixed(3),
      rsi: rsiArr[i] !== null ? +rsiArr[i]!.toFixed(2) : null,
      atr: atrArr[i],
      avwap: avwapArr[i] !== null ? +avwapArr[i]!.toFixed(2) : null,
      poc: pocPrice,
      rs: rsArr[i] !== null ? +rsArr[i]!.toFixed(4) : null,
      ...bbArr[i],
    }))
  }, [rawData, customAnchorIdx])

  const displayData = useMemo(() => {
    const base = Math.min(processed.length, MAX_CANDLES)
    const range = zoomRange !== null ? Math.min(zoomRange, processed.length) : base
    return processed.slice(Math.max(0, processed.length - range))
  }, [processed, zoomRange])

  function zoomIn() {
    setZoomRange(prev => Math.max(20, Math.floor((prev ?? Math.min(processed.length, MAX_CANDLES)) * 0.6)))
  }
  function zoomOut() {
    const current = zoomRange ?? Math.min(processed.length, MAX_CANDLES)
    const next = Math.ceil(current / 0.6)
    setZoomRange(next >= processed.length ? null : next)
  }

  const INTERVALS: { value: Interval; label: string }[] = [
    { value: '1d', label: '日K' },
    { value: '1h', label: '小時K' },
    { value: '1m', label: '1分K' },
  ]

  const latest = displayData[displayData.length - 1]

  function handleChartClick(data: any) {
    if (!anchorMode || data?.activeTooltipIndex === undefined) return
    const offset = processed.length - displayData.length
    setCustomAnchorIdx(offset + data.activeTooltipIndex)
    setAnchorMode(false)
  }

  return (
    <section ref={sectionRef} className="sm-section sm-chart-section">
      <div className="sm-chart-header">
        <h2>{ticker}{chartName ? ` ${chartName}` : ''} 圖表</h2>
        {signal && (
          <span className={`sm-signal ${SIGNAL_CLASS[signal] ?? 'signal-neutral'}`}
            style={{ fontSize: '0.82rem' }}>
            {SIGNAL_ICON[signal]}{signal}
          </span>
        )}
        {score !== null && score !== undefined && (
          <span className={`sm-score-badge ${score >= 5 ? 'score-bull' : score <= -3 ? 'score-bear' : 'score-neutral'}`}
            style={{ fontSize: '0.8rem' }}>
            {score > 0 ? '+' : ''}{score}分
          </span>
        )}
        <div className="sm-interval-group">
          {INTERVALS.map(iv => (
            <button key={iv.value}
              className={`sm-interval-btn${interval === iv.value ? ' active' : ''}`}
              onClick={() => setInterval(iv.value)}>
              {iv.label}
            </button>
          ))}
        </div>
        <button className={`sm-interval-btn${showBB ? ' active' : ''}`}
          onClick={() => setShowBB(v => !v)} title="顯示/隱藏布林通道">布林</button>
        <button className={`sm-interval-btn${anchorMode ? ' active' : ''}`}
          onClick={() => setAnchorMode(v => !v)} title="點擊圖表設定 AVWAP 錨點">
          {anchorMode ? '取消設錨' : '設定錨點'}
        </button>
        {customAnchorIdx !== null && (
          <button className="sm-interval-btn" onClick={() => setCustomAnchorIdx(null)}
            title="重置為 60 日最低點">重置錨點</button>
        )}
        <div className="sm-zoom-group">
          <button className="sm-interval-btn" onClick={zoomIn} title="放大（顯示更少K棒）">＋</button>
          <span className="sm-zoom-label">{displayData.length}根</span>
          <button className="sm-interval-btn" onClick={zoomOut} title="縮小（顯示更多K棒）">－</button>
        </div>
        <button
          className={`sm-interval-btn${newsVisible ? ' active' : ''}`}
          onClick={() => {
            if (newsVisible) { setNewsVisible(false) }
            else if (newsItems.length > 0) { setNewsVisible(true) }
            else { fetchNews() }
          }}
          title="查詢相關新聞">
          {newsLoading ? '載入中…' : '查詢新聞'}
        </button>
        <button className="sm-btn sm-btn-ghost sm-chart-close" onClick={onClose}>✕ 關閉</button>
      </div>
      {anchorMode && (
        <p className="sm-anchor-hint">↓ 點擊下方圖表上任意 K 棒以設定 AVWAP 錨點</p>
      )}

      {loading && <p className="sm-empty">載入中…</p>}
      {error && <p className="sm-empty" style={{ color: '#f472b6' }}>⚠ {error}</p>}

      {!loading && !error && displayData.length > 0 && (
        <>
          {/* 主圖：蠟燭 + EMA + AVWAP + BB + POC */}
          <div className="sm-chart-main">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={displayData} syncId="sm-chart"
                margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
                onClick={handleChartClick}
                style={{ cursor: anchorMode ? 'crosshair' : 'default' }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="time" stroke="#444" tick={{ fill: '#888', fontSize: 11 }} minTickGap={40} />
                <YAxis
                  domain={[
                    (dataMin: number) => {
                      const mn = entryPrice && entryPrice > 0 ? Math.min(dataMin, entryPrice) : dataMin
                      return +(mn * 0.995).toFixed(2)
                    },
                    (dataMax: number) => {
                      const mx = entryPrice && entryPrice > 0 ? Math.max(dataMax, entryPrice) : dataMax
                      return +(mx * 1.005).toFixed(2)
                    },
                  ]}
                  stroke="#444" tick={{ fill: '#888', fontSize: 11 }} width={56} />
                <Tooltip contentStyle={{ background: '#14141e', border: '1px solid #333', fontSize: 12 }}
                  itemStyle={{ color: '#ccc' }} labelStyle={{ color: '#888' }} />
                {latest?.poc > 0 && (
                  <ReferenceLine y={latest.poc} stroke="#8b5cf6" strokeDasharray="4 4"
                    label={{ value: 'POC', position: 'insideBottomRight', fill: '#8b5cf6', fontSize: 11 }} />
                )}
                {entryPrice && entryPrice > 0 && (
                  <ReferenceLine y={entryPrice} stroke="#fb923c" strokeDasharray="6 3" strokeWidth={1.5}
                    label={{ value: `成本 ${entryPrice}`, position: 'insideTopRight', fill: '#fb923c', fontSize: 11 }} />
                )}
                {showBB && <>
                  <Line type="monotone" dataKey="bb_upper" stroke="#475569" strokeWidth={1}
                    strokeDasharray="3 3" dot={false} isAnimationActive={false} name="BB上" />
                  <Line type="monotone" dataKey="bb_lower" stroke="#475569" strokeWidth={1}
                    strokeDasharray="3 3" dot={false} isAnimationActive={false} name="BB下" />
                </>}
                <Bar dataKey={(d: any) => [d.low, d.high]} shape={<CandleShape />}
                  isAnimationActive={false} name="K線" />
                <Line type="monotone" dataKey="ema8" stroke="#60a5fa" strokeWidth={1.5}
                  dot={false} isAnimationActive={false} name="EMA8" />
                <Line type="monotone" dataKey="ema21" stroke="#fbbf24" strokeWidth={1.5}
                  dot={false} isAnimationActive={false} name="EMA21" />
                <Line type="monotone" dataKey="ema55" stroke="#a78bfa" strokeWidth={1.5}
                  dot={false} isAnimationActive={false} name="EMA55" />
                <Line type="monotone" dataKey="avwap" stroke="#34d399" strokeWidth={2}
                  strokeDasharray="5 5" dot={false} isAnimationActive={false} name="AVWAP" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* 圖例 */}
          <div className="sm-chart-legend">
            <span style={{ color: '#60a5fa' }}>── EMA8</span>
            <span style={{ color: '#fbbf24' }}>── EMA21</span>
            <span style={{ color: '#a78bfa' }}>── EMA55</span>
            <span style={{ color: '#34d399' }}>╌╌ AVWAP</span>
            <span style={{ color: '#8b5cf6' }}>╌╌ POC</span>
            {showBB && <span style={{ color: '#475569' }}>╌╌ BB(20,2)</span>}
            {entryPrice && entryPrice > 0 && <span style={{ color: '#fb923c' }}>╌╌ 成本</span>}
          </div>

          {/* 成交量子圖 */}
          <div className="sm-chart-sub-label">成交量</div>
          <div className="sm-chart-vol">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={displayData} syncId="sm-chart"
                margin={{ top: 2, right: 12, bottom: 0, left: 0 }}>
                <XAxis dataKey="time" hide />
                <YAxis stroke="#444" tick={{ fill: '#888', fontSize: 10 }} width={56}
                  tickFormatter={(v: number) => v >= 1e8 ? `${(v / 1e8).toFixed(0)}億` : v >= 1e4 ? `${(v / 1e4).toFixed(0)}萬` : String(v)} />
                <Tooltip contentStyle={{ background: '#14141e', border: '1px solid #333', fontSize: 11 }}
                  itemStyle={{ color: '#ccc' }}
                  formatter={(v: number) => [v.toLocaleString(), '成交量']} />
                <Bar dataKey="volume" isAnimationActive={false} name="量">
                  {displayData.map((d, i) => (
                    <Cell key={i} fill={(d.close ?? 0) >= (d.open ?? 0) ? '#ef4444' : '#22c55e'} opacity={0.6} />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* MACD 子圖 */}
          <div className="sm-chart-sub-label">MACD (12, 26, 9)</div>
          <div className="sm-chart-sub">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={displayData} syncId="sm-chart"
                margin={{ top: 2, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis domain={['auto', 'auto']} stroke="#444" tick={{ fill: '#888', fontSize: 10 }} width={56} />
                <Tooltip contentStyle={{ background: '#14141e', border: '1px solid #333', fontSize: 11 }}
                  itemStyle={{ color: '#ccc' }} />
                <ReferenceLine y={0} stroke="#555" />
                <Bar dataKey="macdHist" isAnimationActive={false} name="Hist">
                  {displayData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.macdHist >= 0 ? '#34d399' : '#f472b6'} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="macdLine" stroke="#60a5fa" strokeWidth={1.5}
                  dot={false} isAnimationActive={false} name="MACD" />
                <Line type="monotone" dataKey="macdSignal" stroke="#fbbf24" strokeWidth={1.5}
                  dot={false} isAnimationActive={false} name="Signal" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* RSI 子圖 */}
          <div className="sm-chart-sub-label">RSI (14)</div>
          <div className="sm-chart-sub">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayData} syncId="sm-chart"
                margin={{ top: 2, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis domain={[0, 100]} stroke="#444" tick={{ fill: '#888', fontSize: 10 }} width={56} ticks={[30, 50, 70]} />
                <Tooltip contentStyle={{ background: '#14141e', border: '1px solid #333', fontSize: 11 }}
                  itemStyle={{ color: '#ccc' }} />
                <ReferenceLine y={70} stroke="#f472b6" strokeDasharray="3 3" />
                <ReferenceLine y={30} stroke="#34d399" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="rsi" stroke="#e2a832" strokeWidth={1.5}
                  dot={false} isAnimationActive={false} name="RSI" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* RS Line 子圖 */}
          <div className="sm-chart-sub-label">相對大盤強度 (RS vs ^TWII)</div>
          <div className="sm-chart-sub">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayData} syncId="sm-chart"
                margin={{ top: 2, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis domain={['auto', 'auto']} stroke="#444" tick={{ fill: '#888', fontSize: 10 }} width={56} />
                <Tooltip contentStyle={{ background: '#14141e', border: '1px solid #333', fontSize: 11 }}
                  itemStyle={{ color: '#ccc' }} />
                <Line type="monotone" dataKey="rs" stroke="#a78bfa" strokeWidth={1.5}
                  dot={false} isAnimationActive={false} name="RS" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* 新聞區 */}
      {newsVisible && (
        <div className="sm-news-section">
          <div className="sm-news-header">
            <span>相關新聞</span>
            {(newsSector || newsIndustry) && (
              <span className="sm-sector-badge">
                {newsSector}{newsIndustry ? ` / ${newsIndustry}` : ''}
              </span>
            )}
            {newsItems.length > 0 && (
              <button className="sm-interval-btn" onClick={fetchNews} title="重新抓取新聞">重新整理</button>
            )}
            <button
              className={`sm-interval-btn${sectorVisible ? ' active' : ''}`}
              onClick={() => {
                if (sectorVisible) { setSectorVisible(false) }
                else if (sectorData.length > 0) { setSectorVisible(true) }
                else { fetchSectorOverview() }
              }}
              title="載入各板塊近期漲跌概況">
              {sectorLoading ? '載入中…' : '板塊概況'}
            </button>
          </div>

          {newsLoading && <p className="sm-empty">查詢中（含 AI 摘要，請稍候）…</p>}
          {newsError && <p className="sm-empty" style={{ color: '#f472b6' }}>⚠ {newsError}</p>}
          {!newsLoading && newsItems.length === 0 && !newsError && (
            <p className="sm-empty">查無相關新聞</p>
          )}

          {/* Gemini AI 摘要 */}
          {newsSummary && (
            <div className="sm-news-summary">
              <div className="sm-news-summary-label">✦ Gemini AI 摘要</div>
              <pre className="sm-news-summary-text">{newsSummary}</pre>
            </div>
          )}

          {/* 板塊概況表格 */}
          {sectorVisible && sectorData.length > 0 && (
            <div className="sm-sector-overview">
              <div className="sm-sector-overview-title">板塊近期漲跌概況</div>
              <table className="sm-sector-table">
                <thead>
                  <tr>
                    <th>板塊</th>
                    <th>日漲跌</th>
                    <th>5日漲跌</th>
                    <th>成分股</th>
                  </tr>
                </thead>
                <tbody>
                  {sectorData.map(s => (
                    <tr key={s.sector}
                      className={s.avg_1d !== null ? s.avg_1d > 0 ? 'sector-up' : s.avg_1d < 0 ? 'sector-down' : '' : ''}>
                      <td className="sector-name">{s.sector}</td>
                      <td className={s.avg_1d !== null ? s.avg_1d > 0 ? 'td-positive' : s.avg_1d < 0 ? 'td-negative' : '' : ''}>
                        {s.avg_1d !== null ? `${s.avg_1d > 0 ? '+' : ''}${s.avg_1d}%` : '—'}
                      </td>
                      <td className={s.avg_5d !== null ? s.avg_5d > 0 ? 'td-positive' : s.avg_5d < 0 ? 'td-negative' : '' : ''}>
                        {s.avg_5d !== null ? `${s.avg_5d > 0 ? '+' : ''}${s.avg_5d}%` : '—'}
                      </td>
                      <td className="sector-tickers">
                        {s.tickers.map(t => (
                          <span key={t.ticker}
                            className={`sector-chip ${t.r1d !== null ? t.r1d > 0 ? 'sector-chip-up' : t.r1d < 0 ? 'sector-chip-down' : '' : ''}`}
                            title={`${t.name} 日漲跌 ${t.r1d !== null ? (t.r1d > 0 ? '+' : '') + t.r1d + '%' : '—'}`}>
                            {t.ticker}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {sectorLoading && <p className="sm-empty" style={{ fontSize: '0.82rem' }}>載入板塊資料中（約10秒）…</p>}

          <ul className="sm-news-list">
            {newsItems.map((n, i) => (
              <li key={i} className="sm-news-item">
                <a href={n.link} target="_blank" rel="noopener noreferrer" className="sm-news-title">
                  {n.title}
                </a>
                <span className="sm-news-meta">
                  {n.publisher && <span>{n.publisher}</span>}
                  {n.time_str && <span>{n.time_str}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

// ── 主頁面 ────────────────────────────────────────────
export default function StockMonitor() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(loadWatchlist)
  const [scanData, setScanData] = useState<ScanResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<WatchlistItem | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [chartTicker, setChartTicker] = useState<string | null>(null)

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Auto-scan
  const [autoScan, setAutoScan] = useState(false)
  const [autoInterval, setAutoInterval] = useState(5)
  const [countdown, setCountdown] = useState(0)
  const countdownRef = useRef(0)
  const scanFnRef = useRef<() => void>(() => {})

  // History
  const [scanHistory, setScanHistory] = useState<ScanHistory[]>(loadHistory)
  const [showHistory, setShowHistory] = useState(false)

  // Screener
  const [screenerData, setScreenerData] = useState<ScreenerResponse | null>(null)
  const [screenerLoading, setScreenerLoading] = useState(false)
  const [screenerError, setScreenerError] = useState<string | null>(null)
  const [showScreener, setShowScreener] = useState(false)

  // Import ref
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => { saveWatchlist(watchlist) }, [watchlist])

  // Always keep scan fn ref up-to-date
  useEffect(() => { scanFnRef.current = handleScan })

  // Auto-scan timer
  useEffect(() => {
    if (!autoScan) { countdownRef.current = 0; setCountdown(0); return }
    countdownRef.current = autoInterval * 60
    setCountdown(countdownRef.current)
    const timer = setInterval(() => {
      countdownRef.current = Math.max(0, countdownRef.current - 1)
      setCountdown(countdownRef.current)
      if (countdownRef.current === 0) {
        countdownRef.current = autoInterval * 60
        scanFnRef.current()
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [autoScan, autoInterval])

  // Save scan to history
  useEffect(() => {
    if (!scanData) return
    const entry: ScanHistory = { timestamp: scanData.scanned_at, results: scanData.results }
    setScanHistory(prev => {
      const next = [entry, ...prev.filter(h => h.timestamp !== entry.timestamp)].slice(0, 20)
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
      return next
    })
  }, [scanData])

  // Auto-fetch signal when chart opens for a ticker without existing scan data
  useEffect(() => {
    if (!chartTicker) return
    const hasData = scanData?.results.find(r => r.ticker === chartTicker) ||
                    screenerData?.results.find(r => r.ticker === chartTicker)
    if (hasData) return
    const controller = new AbortController()
    fetch(`${API_BASE}/api/stock/scan?tickers=${chartTicker}`, { signal: controller.signal })
      .then(r => r.json())
      .then((data: ScanResponse) => {
        setScanData(prev => {
          if (!prev) return data
          const others = prev.results.filter(r => r.ticker !== chartTicker)
          return { ...prev, results: [...others, ...data.results] }
        })
      })
      .catch(() => {})
    return () => controller.abort()
  }, [chartTicker]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave(item: WatchlistItem) {
    setWatchlist(prev => {
      const idx = prev.findIndex(w => w.ticker === item.ticker)
      if (idx >= 0) { const next = [...prev]; next[idx] = item; return next }
      return [...prev, item]
    })
    setShowModal(false)
  }

  function handleDelete(ticker: string) {
    setWatchlist(prev => prev.filter(w => w.ticker !== ticker))
    if (chartTicker === ticker) setChartTicker(null)
  }

  async function handleScan() {
    if (watchlist.length === 0) { setError('請先新增標的'); return }
    setLoading(true); setError(null)
    // 預先喚醒 Render 冷啟動（fire-and-forget）
    fetch(`${API_BASE}/health`).catch(() => {})
    try {
      const tickers = watchlist.map(w => w.ticker).join(',')
      const res = await fetch(`${API_BASE}/api/stock/scan?tickers=${encodeURIComponent(tickers)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: ScanResponse = await res.json()
      setScanData(data)
    } catch (e) {
      setError(`掃描失敗：${e instanceof Error ? e.message : e}`)
    } finally {
      setLoading(false)
    }
  }

  function getWatchItem(ticker: string): WatchlistItem | undefined {
    return watchlist.find(w => w.ticker === ticker)
  }

  function openChart(ticker: string) {
    setChartTicker(prev => prev === ticker ? null : ticker)
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(watchlist, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `watchlist-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (Array.isArray(data)) { setWatchlist(data); e.target.value = '' }
      } catch { /* ignore invalid JSON */ }
    }
    reader.readAsText(file)
  }

  async function handleScreener() {
    setScreenerLoading(true); setScreenerError(null); setShowScreener(true)
    try {
      const res = await fetch(`${API_BASE}/api/stock/screener?min_score=5`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setScreenerData(await res.json())
    } catch (e) {
      setScreenerError(`尋股失敗：${e instanceof Error ? e.message : e}`)
    } finally {
      setScreenerLoading(false)
    }
  }

  // Processed results (with pnl)
  const processedResults = useMemo(() => {
    if (!scanData) return []
    return scanData.results.map(row => {
      const w = getWatchItem(row.ticker)
      const hasCost = w && w.entryPrice > 0 && row.close !== null
      const pnl = hasCost ? pnlPct(row.close!, w!.entryPrice) : null
      return { ...row, pnl, witem: w }
    })
  }, [scanData, watchlist])

  // Sorted results
  const sortedResults = useMemo(() => {
    if (!sortKey) return processedResults
    return [...processedResults].sort((a, b) => {
      const getV = (r: typeof processedResults[0]): number => {
        if (sortKey === 'pnl') return r.pnl ?? -Infinity
        const v = r[sortKey as keyof TickerResult]
        return typeof v === 'number' ? v : -Infinity
      }
      return sortDir === 'desc' ? getV(b) - getV(a) : getV(a) - getV(b)
    })
  }, [processedResults, sortKey, sortDir])

  // Portfolio summary（損益扣除同行情損益一致的手續費+稅 0.585%）
  const portfolio = useMemo(() => {
    if (processedResults.length === 0) return null
    let totalCost = 0, totalValue = 0, count = 0
    processedResults.forEach(r => {
      if (!r.witem?.entryPrice || !r.witem?.shares || !r.close) return
      totalCost += r.witem.entryPrice * r.witem.shares * 1000
      totalValue += r.close * r.witem.shares * 1000
      count++
    })
    if (count === 0) return null
    // 與 pnlPct() 一致：扣除賣出稅(0.3%) + 買入手續費(0.1425%) + 賣出手續費(0.1425%)
    const ROUND_TRIP_COST = 0.003 + 0.001425 * 2  // 0.00585
    const pnl = totalValue - totalCost - totalCost * ROUND_TRIP_COST
    const pct = totalCost > 0 ? pnl / totalCost * 100 : 0
    return { totalValue, totalCost, pnl, pct }
  }, [processedResults])

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return <span className="sm-sort-icon">⇅</span>
    return <span className="sm-sort-icon active">{sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  return (
    <div className="sm-page">
      {/* Header */}
      <header className="sm-header">
        <div className="sm-title">
          <span className="sm-title-icon">📈</span>
          <div>
            <h1>台股波段監控</h1>
            <p>整合技術指標與投信籌碼的短線訊號儀表板</p>
          </div>
        </div>
        <div className="sm-header-right">
          <button className="sm-btn sm-btn-screener" onClick={handleScreener}
            disabled={screenerLoading} title="自動搜索台股中得分≥5的標的">
            {screenerLoading ? '🔍 搜尋中…' : '🔍 一鍵尋股'}
          </button>
          <button className="sm-btn sm-btn-scan" onClick={handleScan}
            disabled={loading || watchlist.length === 0}>
            {loading ? '⏳ 掃描中…' : '▶ 執行掃描'}
          </button>
          <div className="sm-auto-wrap">
            <button className={`sm-interval-btn${autoScan ? ' active' : ''}`}
              onClick={() => setAutoScan(v => !v)}
              title="自動定時掃描">
              {autoScan ? `⏱ ${fmtCountdown(countdown)}` : '自動掃描'}
            </button>
            {autoScan && (
              <div className="sm-auto-controls">
                {[3, 5, 10].map(m => (
                  <button key={m}
                    className={`sm-interval-btn${autoInterval === m ? ' active' : ''}`}
                    onClick={() => { setAutoInterval(m); countdownRef.current = m * 60; setCountdown(m * 60) }}>
                    {m}分
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Banners */}
      {scanData?.systemic_risk && (
        <div className="sm-banner-risk">
          <span>⚠ {scanData.systemic_msg}</span>
          <span className="sm-banner-note">— 各標的訊號仍正常顯示，請自行評估風險</span>
        </div>
      )}
      {scanData && !scanData.systemic_risk && scanData.systemic_msg && (
        <div className="sm-banner-ok">
          ✓ {scanData.systemic_msg}
          <span className="sm-scan-time">掃描時間：{scanData.scanned_at.replace('T', ' ')}</span>
        </div>
      )}
      {error && <div className="sm-banner-error">✗ {error}</div>}

      {/* Watchlist */}
      <section className="sm-section">
        <div className="sm-section-head">
          <h2>持倉清單 <span className="sm-count">{watchlist.length}</span></h2>
          <div className="sm-watchlist-actions">
            <button className="sm-btn sm-btn-add"
              onClick={() => { setEditTarget(null); setShowModal(true) }}>
              + 新增
            </button>
            <button className="sm-btn sm-btn-ghost sm-btn-sm" onClick={handleExport}>⬇ 匯出</button>
            <button className="sm-btn sm-btn-ghost sm-btn-sm" onClick={() => importRef.current?.click()}>⬆ 匯入</button>
            <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          </div>
        </div>
        {watchlist.length === 0 ? (
          <p className="sm-empty">尚無標的，點擊「新增」加入</p>
        ) : (
          <div className="sm-chips">
            {watchlist.map(item => (
              <div key={item.ticker}
                className={`sm-chip${chartTicker === item.ticker ? ' sm-chip-active' : ''}`}
                onClick={() => openChart(item.ticker)}>
                <span className="sm-chip-ticker">{item.ticker}</span>
                {TW_NAMES[item.ticker] && <span className="sm-chip-name">{TW_NAMES[item.ticker]}</span>}
                {item.entryPrice > 0 && <span className="sm-chip-meta">@{item.entryPrice}</span>}
                {item.shares > 0 && <span className="sm-chip-meta">{item.shares}張</span>}
                <button className="sm-chip-edit" onClick={e => {
                  e.stopPropagation(); setEditTarget(item); setShowModal(true)
                }} aria-label="編輯">✎</button>
                <button className="sm-chip-del" onClick={e => {
                  e.stopPropagation(); handleDelete(item.ticker)
                }} aria-label="刪除">✕</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* K 線圖 */}
      {chartTicker && (
        <ChartPanel key={chartTicker} ticker={chartTicker}
          entryPrice={getWatchItem(chartTicker)?.entryPrice}
          signal={
            scanData?.results.find(r => r.ticker === chartTicker)?.signal ??
            screenerData?.results.find(r => r.ticker === chartTicker)?.signal ??
            undefined
          }
          score={
            scanData?.results.find(r => r.ticker === chartTicker)?.score ??
            screenerData?.results.find(r => r.ticker === chartTicker)?.score ??
            undefined
          }
          onClose={() => setChartTicker(null)} />
      )}

      {/* Results Table */}
      {scanData && sortedResults.length > 0 && (
        <section className="sm-section">
          <div className="sm-section-head">
            <h2>掃描結果</h2>
            <button className="sm-btn sm-btn-ghost sm-btn-sm"
              onClick={() => setShowHistory(v => !v)}>
              {showHistory ? '▲ 隱藏歷史' : '▼ 掃描歷史'}
            </button>
          </div>
          <div className="sm-table-wrap">
            <table className="sm-table">
              <thead>
                <tr>
                  <th>代號</th>
                  <th>還原收盤</th>
                  <th>AVWAP</th>
                  <th>投信淨買(張)</th>
                  <th className="sm-th-sort" onClick={() => toggleSort('zscore')}>Z-Score {sortIcon('zscore')}</th>
                  <th className="sm-th-sort" onClick={() => toggleSort('td_count')}>TD {sortIcon('td_count')}</th>
                  <th className="sm-th-sort" onClick={() => toggleSort('rsi')}>RSI {sortIcon('rsi')}</th>
                  <th>停損參考</th>
                  <th className="sm-th-sort" onClick={() => toggleSort('rr_ratio')}>RR比 {sortIcon('rr_ratio')}</th>
                  <th className="sm-th-sort" onClick={() => toggleSort('score')}>得分 {sortIcon('score')}</th>
                  <th>成本</th>
                  <th className="sm-th-sort" onClick={() => toggleSort('pnl')}>未實現損益 {sortIcon('pnl')}</th>
                  <th>判定</th>
                </tr>
              </thead>
              <tbody>
                {sortedResults.map((row) => {
                  const { witem, pnl } = row
                  const hasCost = witem && witem.entryPrice > 0 && row.close !== null
                  const stopTriggered = hasCost && row.stop_loss !== null && row.close! < row.stop_loss
                  const takeProfitAlert = hasCost && pnl !== null && pnl >= 15 && row.rsi !== null && row.rsi > 75
                  return (
                    <tr key={row.ticker} className={row.error ? 'row-error' : ''}
                      style={{ cursor: 'pointer' }} onClick={() => openChart(row.ticker)}>
                      <td className="td-ticker">
                        {row.ticker}
                        {(row.name || TW_NAMES[row.ticker]) && (
                          <span className="td-name">{row.name || TW_NAMES[row.ticker]}</span>
                        )}
                      </td>
                      <td>{row.close ?? '—'}</td>
                      <td>{row.avwap ?? '—'}</td>
                      <td className={row.net_buy !== null ? row.net_buy > 0 ? 'td-positive' : row.net_buy < 0 ? 'td-negative' : '' : ''}>
                        {row.net_buy !== null ? (row.net_buy > 0 ? '+' : '') + row.net_buy : '—'}
                      </td>
                      <td className={row.zscore !== null ? row.zscore < -1.5 ? 'td-positive' : row.zscore > 2 ? 'td-negative' : '' : ''}>
                        {row.zscore !== null ? row.zscore.toFixed(2) : '—'}
                      </td>
                      <td className={row.td_count !== null ? row.td_count <= -8 ? 'td-positive' : row.td_count >= 9 ? 'td-negative' : '' : ''}>
                        {row.td_count !== null ? row.td_count : '—'}
                      </td>
                      <td className={row.rsi !== null ? row.rsi < 30 ? 'td-positive' : row.rsi > 70 ? 'td-negative' : '' : ''}>
                        {row.rsi !== null ? row.rsi.toFixed(1) : '—'}
                      </td>
                      <td className="td-stop">
                        {row.stop_loss !== null ? row.stop_loss : '—'}
                        {stopTriggered && <span className="td-alert" title="ATR 停損觸發"> 🛑</span>}
                      </td>
                      <td className={row.rr_ratio !== null ? row.rr_ratio >= 2.5 ? 'td-positive' : 'td-muted' : ''}>
                        {row.rr_ratio !== null ? row.rr_ratio.toFixed(1) : '—'}
                      </td>
                      <td>
                        {row.score !== null && row.score !== undefined ? (
                          <span className={`sm-score-badge ${row.score >= 5 ? 'score-bull' : row.score <= -3 ? 'score-bear' : 'score-neutral'}`}>
                            {row.score > 0 ? '+' : ''}{row.score}
                          </span>
                        ) : '—'}
                      </td>
                      <td>{witem?.entryPrice ? witem.entryPrice : '—'}</td>
                      <td className={pnl !== null ? pnl >= 0 ? 'td-positive' : 'td-negative' : ''}>
                        {pnl !== null ? `${pnl >= 0 ? '+' : ''}${pnl}%` : '—'}
                        {takeProfitAlert && <span className="td-alert" title="停利條件成立"> 💰</span>}
                      </td>
                      <td>
                        <span className={`sm-signal ${SIGNAL_CLASS[row.signal ?? ''] ?? 'signal-neutral'}`}>
                          {SIGNAL_ICON[row.signal ?? '']}{row.signal}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Portfolio Summary */}
          {portfolio && (
            <div className="sm-portfolio">
              <div className="sm-portfolio-item">
                <span>總市值</span>
                <strong>NT$ {portfolio.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
              </div>
              <div className="sm-portfolio-item">
                <span>總成本</span>
                <strong>NT$ {portfolio.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
              </div>
              <div className="sm-portfolio-item">
                <span>未實現損益</span>
                <strong className={portfolio.pnl >= 0 ? 'td-positive' : 'td-negative'}>
                  {portfolio.pnl >= 0 ? '+' : ''}NT$ {Math.round(portfolio.pnl).toLocaleString()}
                  <span style={{ marginLeft: '0.4rem', fontSize: '0.9em' }}>
                    ({portfolio.pct >= 0 ? '+' : ''}{portfolio.pct.toFixed(2)}%)
                  </span>
                </strong>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 掃描歷史 */}
      {showHistory && scanHistory.length > 0 && (
        <section className="sm-section sm-history-section">
          <h2>掃描歷史 <span className="sm-count">{scanHistory.length}</span></h2>
          <div className="sm-history-list">
            {scanHistory.map((entry, i) => (
              <div key={i} className="sm-history-entry">
                <span className="sm-history-time">{entry.timestamp.replace('T', ' ')}</span>
                <div className="sm-history-chips">
                  {entry.results.map(r => (
                    <span key={r.ticker}
                      className={`sm-history-chip sm-signal ${SIGNAL_CLASS[r.signal ?? ''] ?? 'signal-neutral'}`}>
                      {r.ticker}
                      {r.score !== null ? ` ${r.score! > 0 ? '+' : ''}${r.score}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 一鍵尋股結果 */}
      {showScreener && (
        <section className="sm-section sm-screener-section">
          <div className="sm-section-head">
            <h2>一鍵尋股結果
              {screenerData && <span className="sm-count">{screenerData.results.length}/{screenerData.total_scanned}</span>}
            </h2>
            <button className="sm-btn sm-btn-ghost sm-btn-sm" onClick={() => setShowScreener(false)}>✕ 關閉</button>
          </div>
          {screenerLoading && <p className="sm-empty">正在掃描 {screenerData?.total_scanned ?? 50} 檔標的，約需 20-30 秒…</p>}
          {screenerError && <p className="sm-empty" style={{ color: '#f472b6' }}>{screenerError}</p>}
          {screenerData && !screenerLoading && (
            screenerData.results.length === 0
              ? <p className="sm-empty">目前無符合條件（得分≥5）的標的</p>
              : <>
                <p className="sm-screener-note">掃描時間：{screenerData.scanned_at.replace('T', ' ')}　點擊代號可加入持倉清單</p>
                <div className="sm-table-wrap">
                  <table className="sm-table">
                    <thead>
                      <tr>
                        <th>代號</th><th>收盤</th><th>RSI</th><th>Z-Score</th>
                        <th>RR比</th><th>得分</th><th>判定</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {screenerData.results.map(r => (
                        <tr key={r.ticker} style={{ cursor: 'pointer' }} onClick={() => openChart(r.ticker)}>
                          <td className="td-ticker">
                            {r.ticker}
                            {(r.name || TW_NAMES[r.ticker]) && (
                              <span className="td-name">{r.name || TW_NAMES[r.ticker]}</span>
                            )}
                          </td>
                          <td>{r.close ?? '—'}</td>
                          <td className={r.rsi !== null ? r.rsi < 30 ? 'td-positive' : r.rsi > 70 ? 'td-negative' : '' : ''}>
                            {r.rsi !== null ? r.rsi.toFixed(1) : '—'}
                          </td>
                          <td className={r.zscore !== null ? r.zscore < -1.5 ? 'td-positive' : '' : ''}>
                            {r.zscore !== null ? r.zscore.toFixed(2) : '—'}
                          </td>
                          <td className={r.rr_ratio !== null && r.rr_ratio >= 2.5 ? 'td-positive' : 'td-muted'}>
                            {r.rr_ratio !== null ? r.rr_ratio.toFixed(1) : '—'}
                          </td>
                          <td>
                            <span className={`sm-score-badge ${(r.score ?? 0) >= 5 ? 'score-bull' : 'score-neutral'}`}>
                              {(r.score ?? 0) > 0 ? '+' : ''}{r.score}
                            </span>
                          </td>
                          <td>
                            <span className={`sm-signal ${SIGNAL_CLASS[r.signal ?? ''] ?? 'signal-neutral'}`}>
                              {SIGNAL_ICON[r.signal ?? '']}{r.signal}
                            </span>
                          </td>
                          <td>
                            {!getWatchItem(r.ticker) && (
                              <button className="sm-btn sm-btn-add sm-btn-xs"
                                onClick={e => { e.stopPropagation(); handleSave({ ticker: r.ticker, entryPrice: 0, shares: 0 }) }}>
                                + 加入
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
          )}
        </section>
      )}

      {/* 訊號說明 */}
      <section className="sm-section sm-legend">
        <h3>訊號說明</h3>
        <ul>
          <li><span className="sm-signal signal-buy">★ 滿分買進</span> Z&lt;-1.5、TD≤-8、投信買超 &gt;0、近 AVWAP ≤1.5%</li>
          <li><span className="sm-signal signal-buy2">▲ 強烈買進</span> Z&lt;-1.5、TD≤-8</li>
          <li><span className="sm-signal signal-nine">9 九轉買點</span> TD=-9、RSI&lt;40、RR≥2.5</li>
          <li><span className="sm-signal signal-trend">↗ 波段起漲</span> EMA8/21 黃金交叉、站上 EMA55、RR≥2.5</li>
          <li><span className="sm-signal signal-macd">⚡ 動能噴發</span> MACD 零軸上空中加油、RR≥2.5</li>
          <li><span className="sm-signal signal-vwap">⊕ 支撐確認</span> 近 AVWAP 反彈（≤2%）、RR≥2.5</li>
          <li><span className="sm-signal signal-sell">⚠ 強烈賣出</span> Z&gt;2.0 或 TD≥9</li>
          <li><span className="sm-signal signal-nine">9 九轉賣點</span> TD=9、RSI&gt;70</li>
          <li><span className="sm-signal signal-trend-down">↘ 波段轉弱</span> EMA8/21 死亡交叉</li>
          <li><span className="sm-signal signal-risk">系統性風險</span> S&amp;P500 單日跌幅≥2%，暫停買入</li>
        </ul>
        <p className="sm-legend-note">停損參考 = 收盤 - 2×ATR(14)　RR比 = (20日高點 - 收盤) / (2×ATR)　損益已扣雙邊手續費 0.1425%×2 及證交稅 0.3%</p>
      </section>

      {/* 指標說明 */}
      <section className="sm-section sm-indicator-docs">
        <h3>各項指標說明</h3>
        <div className="sm-docs-grid">
          <div className="sm-doc-card">
            <div className="sm-doc-title">得分系統</div>
            <p>多指標加總分數。Z-Score/TD 各貢獻 ±2~3 分，RSI/EMA/MACD/投信/AVWAP/RR 各貢獻 ±1~2 分。≥8 滿分買進，5~7 強烈買進，≤-5 強烈賣出，-2~2 觀察中。</p>
          </div>
          <div className="sm-doc-card">
            <div className="sm-doc-title">Z-Score（均值回歸）</div>
            <p>個股收盤相對20日均線的標準差偏離量。Z&lt;-1.5 代表超跌（買入機會），Z&gt;2.0 代表超漲（賣出警示）。</p>
          </div>
          <div className="sm-doc-card">
            <div className="sm-doc-title">TD Sequential（九轉）</div>
            <p>連續9根K棒遞增（TD+9）或遞減（TD-9）時，代表多空動能耗盡。接近±9時配合RSI與RR判斷進出時機。</p>
          </div>
          <div className="sm-doc-card">
            <div className="sm-doc-title">RSI（相對強弱指數）</div>
            <p>14日動能指標。RSI&lt;30 超賣（潛在買點），RSI&gt;70 超買（潛在賣點）。搭配趨勢使用，避免在下跌趨勢中過早買入。</p>
          </div>
          <div className="sm-doc-card">
            <div className="sm-doc-title">MACD（動能指標）</div>
            <p>EMA12 - EMA26 = MACD線；EMA9(MACD) = 訊號線；兩線之差 = Histogram。Histogram由負轉正且MACD線在零軸上方 = 「空中加油」，是強烈買入訊號。</p>
          </div>
          <div className="sm-doc-card">
            <div className="sm-doc-title">EMA 8 / 21 / 55</div>
            <p>短中長期指數移動平均線。EMA8上穿EMA21（黃金交叉）且站上EMA55為波段起漲訊號；反之死亡交叉為轉弱訊號。</p>
          </div>
          <div className="sm-doc-card">
            <div className="sm-doc-title">AVWAP（錨定成交量加權均價）</div>
            <p>從60日最低點起算的累積成交量均價，代表持有成本中樞。股價近AVWAP（≤2%）且反彈，為支撐確認買點。自訂錨點可從任意K棒重算。</p>
          </div>
          <div className="sm-doc-card">
            <div className="sm-doc-title">POC（成交量密集區）</div>
            <p>Point of Control，從錨點（60日最低點）起算，將所有K棒按價格分箱後累積成交量，取量最大的價格作為 POC（紫色虛線）。代表市場持倉成本最集中的位置，回測守住是強支撐，跌穿則是換手警示。</p>
          </div>
          <div className="sm-doc-card">
            <div className="sm-doc-title">ATR（真實波幅）</div>
            <p>14日平均真實波幅，衡量波動大小。停損設於 收盤 - 2×ATR，讓噪音不觸發停損。ATR也用於計算RR比。</p>
          </div>
          <div className="sm-doc-card">
            <div className="sm-doc-title">RR比（風險報酬比）</div>
            <p>= (20日最高點 - 現價) / (2×ATR)。代表潛在獲利空間 vs 停損風險的比值。RR≥2.5 代表每承擔1元風險有2.5元潛在獲利，為優質進場條件。</p>
          </div>
          <div className="sm-doc-card">
            <div className="sm-doc-title">投信淨買（籌碼面）</div>
            <p>投信當日買入 - 賣出張數。連續買超代表法人信心，配合技術面買進訊號可提高勝率。淨買&gt;0 加分，淨賣扣分。</p>
          </div>
          <div className="sm-doc-card">
            <div className="sm-doc-title">BB 布林通道</div>
            <p>20日均線 ± 2倍標準差。股價碰觸下軌（超跌）或上軌（超漲）時提示波動極端狀態。帶寬收窄代表醞釀突破行情。</p>
          </div>
          <div className="sm-doc-card">
            <div className="sm-doc-title">RS Line（相對強弱線）</div>
            <p>個股收盤 ÷ 大盤（^TWII）收盤，追蹤相對大盤的強弱。RS線上升代表個股跑贏大盤，為選股加分條件；下降則代表相對弱勢。</p>
          </div>
        </div>
      </section>

      {/* Modal */}
      {showModal && (
        <EditModal initial={editTarget} onSave={handleSave}
          onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}
