export interface WatchlistItem {
  ticker: string      // 純數字，如 "2330"
  entryPrice: number  // 成本價（元），0 表示未設定
  shares: number      // 持倉張數（可小數）
}

export interface TickerResult {
  ticker: string
  close: number | null
  avwap: number | null
  net_buy: number | null
  zscore: number | null
  td_count: number | null
  rsi: number | null
  atr: number | null
  stop_loss: number | null
  rr_ratio: number | null
  ema8: number | null
  ema21: number | null
  macd_hist: number | null
  score: number | null
  signal: string | null
  error: string | null
}

export interface ScanResponse {
  systemic_risk: boolean
  systemic_msg: string
  scanned_at: string
  results: TickerResult[]
}

export interface ChartPoint {
  time: string
  price: number | null
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  volume: number
  marketClose: number | null
}

export interface ChartResponse {
  data: ChartPoint[]
  error: string | null
}
