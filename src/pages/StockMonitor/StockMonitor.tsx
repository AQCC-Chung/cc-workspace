import { useState, useEffect, useRef, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ComposedChart, Bar, Cell,
} from 'recharts'
import type { WatchlistItem, TickerResult, ScanResponse, ChartPoint } from './types'
import './StockMonitor.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const STORAGE_KEY = 'stockMonitor_watchlist'

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

// ── Watchlist 持久化 ──────────────────────────────────
function loadWatchlist(): WatchlistItem[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}
function saveWatchlist(list: WatchlistItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

// ── P&L 計算 ──────────────────────────────────────────
function pnlPct(close: number, entry: number): number {
  if (entry === 0) return 0
  const gross = (close - entry) / entry
  return Math.round((gross - 0.003 - 0.001425 * 2) * 10000) / 100
}

// ── 圖表指標計算（client-side）──────────────────────
function calcEMA(prices: number[], span: number): number[] {
  const k = 2 / (span + 1)
  const out: number[] = []
  let ema = prices[0]
  for (const p of prices) {
    ema = (p - ema) * k + ema
    out.push(ema)
  }
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
    else if (i === period) {
      avgGain = (avgGain + g) / period
      avgLoss = (avgLoss + l) / period
    } else {
      avgGain = (avgGain * (period - 1) + g) / period
      avgLoss = (avgLoss * (period - 1) + l) / period
    }
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

// ── 新增/編輯 Modal ──────────────────────────────────
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

interface ChartPanelProps {
  ticker: string
  entryPrice?: number
  onClose: () => void
}

function ChartPanel({ ticker, entryPrice, onClose }: ChartPanelProps) {
  const [interval, setInterval] = useState<Interval>('1d')
  const [rawData, setRawData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`${API_BASE}/api/stock/chart/${ticker}?interval=${interval}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { if (!cancelled) { setRawData(d.data ?? []); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [ticker, interval])

  // 計算所有指標（client-side）
  const processed = useMemo(() => {
    if (rawData.length === 0) return []
    const prices = rawData.map(d => d.price ?? 0)
    const highs = rawData.map(d => d.high ?? d.price ?? 0)
    const lows = rawData.map(d => d.low ?? d.price ?? 0)
    const volumes = rawData.map(d => d.volume)

    // EMA 8 / 21 / 55
    const ema8 = calcEMA(prices, 8)
    const ema21 = calcEMA(prices, 21)
    const ema55 = calcEMA(prices, 55)

    // MACD (12, 26, 9)
    const ema12 = calcEMA(prices, 12)
    const ema26 = calcEMA(prices, 26)
    const macdLine = ema12.map((v, i) => v - ema26[i])
    const signalLine = calcEMA(macdLine, 9)
    const macdHist = macdLine.map((v, i) => v - signalLine[i])

    // RSI (14)
    const rsiArr = calcRSI(prices, 14)

    // ATR (14)
    const atrArr = calcATR(highs, lows, prices, 14)

    // AVWAP — 錨點：60 日最低低點
    const lookback = Math.min(60, rawData.length)
    let lowestLow = Infinity, anchorIdx = 0
    for (let i = rawData.length - lookback; i < rawData.length; i++) {
      if (lows[i] < lowestLow) { lowestLow = lows[i]; anchorIdx = i }
    }
    let cumVol = 0, cumVP = 0
    const avwapArr = rawData.map((d, i) => {
      if (i < anchorIdx) return null
      const tp = ((d.high ?? d.price ?? 0) + (d.low ?? d.price ?? 0) + (d.price ?? 0)) / 3
      cumVol += volumes[i]
      cumVP += tp * volumes[i]
      return cumVol === 0 ? d.price : cumVP / cumVol
    })

    // POC — 最高成交量價位（60日）
    const pocData = rawData.slice(anchorIdx)
    const bins: Record<number, number> = {}
    let maxVol = 0, pocPrice = 0
    pocData.forEach(d => {
      const binSize = (d.price ?? 0) > 100 ? 1 : 0.5
      const bin = Math.round((d.price ?? 0) / binSize) * binSize
      bins[bin] = (bins[bin] || 0) + d.volume
      if (bins[bin] > maxVol) { maxVol = bins[bin]; pocPrice = bin }
    })

    // RS Line vs ^TWII
    const rsArr = rawData.map(d =>
      d.marketClose && d.marketClose > 0 ? (d.price ?? 0) / d.marketClose * 100 : null
    )

    return rawData.map((d, i) => ({
      ...d,
      ema8: +ema8[i].toFixed(2),
      ema21: +ema21[i].toFixed(2),
      ema55: i >= 54 ? +ema55[i].toFixed(2) : null,
      macdHist: +macdHist[i].toFixed(3),
      macdLine: +macdLine[i].toFixed(3),
      macdSignal: +signalLine[i].toFixed(3),
      rsi: rsiArr[i] !== null ? +rsiArr[i]!.toFixed(2) : null,
      atr: atrArr[i],
      avwap: avwapArr[i] !== null ? +avwapArr[i]!.toFixed(2) : null,
      poc: pocPrice,
      rs: rsArr[i] !== null ? +rsArr[i]!.toFixed(4) : null,
    }))
  }, [rawData])

  const INTERVALS: { value: Interval; label: string }[] = [
    { value: '1d', label: '日K' },
    { value: '1h', label: '小時K' },
    { value: '1m', label: '1分K' },
  ]

  const latest = processed[processed.length - 1]

  return (
    <section className="sm-section sm-chart-section">
      <div className="sm-chart-header">
        <h2>{ticker} 圖表</h2>
        <div className="sm-interval-group">
          {INTERVALS.map(iv => (
            <button key={iv.value}
              className={`sm-interval-btn${interval === iv.value ? ' active' : ''}`}
              onClick={() => setInterval(iv.value)}>
              {iv.label}
            </button>
          ))}
        </div>
        <button className="sm-btn sm-btn-ghost sm-chart-close" onClick={onClose}>✕ 關閉</button>
      </div>

      {loading && <p className="sm-empty">載入中…</p>}
      {error && <p className="sm-empty" style={{ color: '#f472b6' }}>⚠ {error}</p>}

      {!loading && !error && processed.length > 0 && (
        <>
          {/* 主圖：價格 + EMA + AVWAP + POC */}
          <div className="sm-chart-main">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={processed} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="time" stroke="#444" tick={{ fill: '#888', fontSize: 11 }} minTickGap={40} />
                <YAxis domain={['auto', 'auto']} stroke="#444" tick={{ fill: '#888', fontSize: 11 }} width={56} />
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
                <Line type="monotone" dataKey="price" stroke="#e2a832" strokeWidth={2} dot={false} isAnimationActive={false} name="價格" />
                <Line type="monotone" dataKey="ema8" stroke="#60a5fa" strokeWidth={1.5} dot={false} isAnimationActive={false} name="EMA8" />
                <Line type="monotone" dataKey="ema21" stroke="#fbbf24" strokeWidth={1.5} dot={false} isAnimationActive={false} name="EMA21" />
                <Line type="monotone" dataKey="ema55" stroke="#a78bfa" strokeWidth={1.5} dot={false} isAnimationActive={false} name="EMA55" />
                <Line type="monotone" dataKey="avwap" stroke="#34d399" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} name="AVWAP" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 圖例 */}
          <div className="sm-chart-legend">
            <span style={{ color: '#e2a832' }}>── 價格</span>
            <span style={{ color: '#60a5fa' }}>── EMA8</span>
            <span style={{ color: '#fbbf24' }}>── EMA21</span>
            <span style={{ color: '#a78bfa' }}>── EMA55</span>
            <span style={{ color: '#34d399' }}>╌╌ AVWAP</span>
            <span style={{ color: '#8b5cf6' }}>╌╌ POC</span>
            {entryPrice && entryPrice > 0 && (
              <span style={{ color: '#fb923c' }}>╌╌ 成本</span>
            )}
          </div>

          {/* MACD 子圖 */}
          <div className="sm-chart-sub-label">MACD (12, 26, 9)</div>
          <div className="sm-chart-sub">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={processed} margin={{ top: 2, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis domain={['auto', 'auto']} stroke="#444" tick={{ fill: '#888', fontSize: 10 }} width={42} />
                <Tooltip contentStyle={{ background: '#14141e', border: '1px solid #333', fontSize: 11 }}
                  itemStyle={{ color: '#ccc' }} />
                <ReferenceLine y={0} stroke="#555" />
                <Bar dataKey="macdHist" isAnimationActive={false} name="Hist">
                  {processed.map((entry, idx) => (
                    <Cell key={idx} fill={entry.macdHist >= 0 ? '#34d399' : '#f472b6'} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="macdLine" stroke="#60a5fa" strokeWidth={1.5} dot={false} isAnimationActive={false} name="MACD" />
                <Line type="monotone" dataKey="macdSignal" stroke="#fbbf24" strokeWidth={1.5} dot={false} isAnimationActive={false} name="Signal" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* RSI 子圖 */}
          <div className="sm-chart-sub-label">RSI (14)</div>
          <div className="sm-chart-sub">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={processed} margin={{ top: 2, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis domain={[0, 100]} stroke="#444" tick={{ fill: '#888', fontSize: 10 }} width={42} ticks={[30, 50, 70]} />
                <Tooltip contentStyle={{ background: '#14141e', border: '1px solid #333', fontSize: 11 }}
                  itemStyle={{ color: '#ccc' }} />
                <ReferenceLine y={70} stroke="#f472b6" strokeDasharray="3 3" />
                <ReferenceLine y={30} stroke="#34d399" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="rsi" stroke="#e2a832" strokeWidth={1.5} dot={false} isAnimationActive={false} name="RSI" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* RS Line 子圖 */}
          <div className="sm-chart-sub-label">相對大盤強度 (RS vs ^TWII)</div>
          <div className="sm-chart-sub">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={processed} margin={{ top: 2, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis domain={['auto', 'auto']} stroke="#444" tick={{ fill: '#888', fontSize: 10 }} width={42} />
                <Tooltip contentStyle={{ background: '#14141e', border: '1px solid #333', fontSize: 11 }}
                  itemStyle={{ color: '#ccc' }} />
                <Line type="monotone" dataKey="rs" stroke="#a78bfa" strokeWidth={1.5} dot={false} isAnimationActive={false} name="RS" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  )
}

// ── 主頁面 ───────────────────────────────────────────
export default function StockMonitor() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(loadWatchlist)
  const [scanData, setScanData] = useState<ScanResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<WatchlistItem | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [chartTicker, setChartTicker] = useState<string | null>(null)

  useEffect(() => { saveWatchlist(watchlist) }, [watchlist])

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
        <button className="sm-btn sm-btn-scan" onClick={handleScan}
          disabled={loading || watchlist.length === 0}>
          {loading ? '⏳ 掃描中…' : '▶ 執行掃描'}
        </button>
      </header>

      {/* Systemic Risk Banner */}
      {scanData?.systemic_risk && (
        <div className="sm-banner-risk">
          <span>⚠ {scanData.systemic_msg}</span>
          <span className="sm-banner-note">— 各標的訊號仍正常顯示，請自行評估風險</span>
        </div>
      )}
      {scanData && !scanData.systemic_risk && (
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
          <button className="sm-btn sm-btn-add"
            onClick={() => { setEditTarget(null); setShowModal(true) }}>
            + 新增
          </button>
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
        <ChartPanel ticker={chartTicker}
          entryPrice={getWatchItem(chartTicker)?.entryPrice}
          onClose={() => setChartTicker(null)} />
      )}

      {/* Results Table */}
      {scanData && scanData.results.length > 0 && (
        <section className="sm-section">
          <h2>掃描結果</h2>
          <div className="sm-table-wrap">
            <table className="sm-table">
              <thead>
                <tr>
                  <th>代號</th>
                  <th>還原收盤</th>
                  <th>AVWAP</th>
                  <th>投信淨買(張)</th>
                  <th>Z-Score</th>
                  <th>TD</th>
                  <th>RSI</th>
                  <th>停損參考</th>
                  <th>RR比</th>
                  <th>得分</th>
                  <th>成本</th>
                  <th>未實現損益</th>
                  <th>判定</th>
                </tr>
              </thead>
              <tbody>
                {scanData.results.map((row: TickerResult) => {
                  const witem = getWatchItem(row.ticker)
                  const hasCost = witem && witem.entryPrice > 0 && row.close !== null
                  const pnl = hasCost ? pnlPct(row.close!, witem!.entryPrice) : null
                  const stopTriggered = hasCost && row.stop_loss !== null && row.close! < row.stop_loss
                  const takeProfitAlert = hasCost && pnl !== null && pnl >= 15 && row.rsi !== null && row.rsi > 75

                  return (
                    <tr key={row.ticker} className={row.error ? 'row-error' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() => openChart(row.ticker)}>
                      <td className="td-ticker">{row.ticker}</td>
                      <td>{row.close ?? '—'}</td>
                      <td>{row.avwap ?? '—'}</td>
                      <td className={row.net_buy !== null
                        ? row.net_buy > 0 ? 'td-positive' : row.net_buy < 0 ? 'td-negative' : ''
                        : ''}>
                        {row.net_buy !== null ? (row.net_buy > 0 ? '+' : '') + row.net_buy : '—'}
                      </td>
                      <td className={row.zscore !== null
                        ? row.zscore < -1.5 ? 'td-positive' : row.zscore > 2 ? 'td-negative' : ''
                        : ''}>
                        {row.zscore !== null ? row.zscore.toFixed(2) : '—'}
                      </td>
                      <td className={row.td_count !== null
                        ? row.td_count <= -8 ? 'td-positive' : row.td_count >= 9 ? 'td-negative' : ''
                        : ''}>
                        {row.td_count !== null ? row.td_count : '—'}
                      </td>
                      <td className={row.rsi !== null
                        ? row.rsi < 30 ? 'td-positive' : row.rsi > 70 ? 'td-negative' : ''
                        : ''}>
                        {row.rsi !== null ? row.rsi.toFixed(1) : '—'}
                      </td>
                      <td className="td-stop">
                        {row.stop_loss !== null ? row.stop_loss : '—'}
                        {stopTriggered && <span className="td-alert" title="ATR 停損觸發"> 🛑</span>}
                      </td>
                      <td className={row.rr_ratio !== null
                        ? row.rr_ratio >= 2.5 ? 'td-positive' : 'td-muted'
                        : ''}>
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
        </section>
      )}

      {/* 說明區 */}
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

      {/* Modal */}
      {showModal && (
        <EditModal initial={editTarget} onSave={handleSave}
          onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}
