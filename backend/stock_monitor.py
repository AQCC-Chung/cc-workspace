"""
台股波段監控核心邏輯 — 供 FastAPI 路由呼叫。
CLI 互動版本請見 Workspace/tw_swing_monitor.py。
"""
from __future__ import annotations

import os
import time
import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

import numpy as np
import pandas as pd
import requests
import yfinance as yf

FINMIND_TOKEN = os.environ.get("FINMIND_TOKEN", "")
FINMIND_URL = "https://api.finmindtrade.com/api/v4/data"
TAX = 0.003
FEE = 0.001425

# ──────────────────────────────────────────
# 台股名稱對照表
# ──────────────────────────────────────────
TW_STOCK_NAMES: dict[str, str] = {
    "0050": "元大台灣50", "0056": "元大高股息",
    "2330": "台積電",  "2454": "聯發科",  "3711": "日月光投控",
    "3034": "聯詠",    "2344": "華邦電",  "3008": "大立光",
    "6488": "環球晶",  "2337": "旺宏",    "6415": "矽力-KY",
    "2317": "鴻海",    "2382": "廣達",    "2357": "華碩",
    "4938": "和碩",    "2376": "技嘉",    "2377": "微星",
    "3231": "緯創",    "2353": "宏碁",    "2308": "台達電",
    "2301": "光寶科",  "2395": "研華",    "2379": "瑞昱",
    "6669": "緯穎",    "2474": "可成",    "3702": "大聯大",
    "2412": "中華電",  "3045": "台灣大",  "4904": "遠傳",
    "2882": "國泰金",  "2881": "富邦金",  "2886": "兆豐金",
    "2891": "中信金",  "2892": "第一金",  "2884": "玉山金",
    "2885": "元大金",  "5880": "合庫金",  "1301": "台塑",
    "1303": "南亞",    "1326": "台化",    "6505": "台塑化",
    "1101": "台泥",    "1102": "亞泥",    "2002": "中鋼",
    "2603": "長榮",    "2609": "陽明",    "2615": "萬海",
    "2912": "統一超",  "2207": "和泰車",  "1216": "統一",
}


# ──────────────────────────────────────────
# 工具
# ──────────────────────────────────────────

def _flatten_columns(df: pd.DataFrame) -> pd.DataFrame:
    """相容 yfinance >= 0.2.38 的 MultiIndex 欄位。"""
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    return df


# ──────────────────────────────────────────
# Module 1：風險過濾
# ──────────────────────────────────────────

def check_systemic_risk() -> dict:
    try:
        df = yf.download("^GSPC", period="5d", auto_adjust=True, progress=False)
        if df is None or len(df) < 2:
            return {"flag": False, "msg": ""}
        df = _flatten_columns(df)
        closes = df["Close"].dropna()
        pct = float((closes.iloc[-1] - closes.iloc[-2]) / closes.iloc[-2])
        if pct <= -0.02:
            return {"flag": True, "msg": f"系統性風險：暫停買入（S&P500 {pct*100:.2f}%）"}
        return {"flag": False, "msg": f"系統正常（S&P500 {pct*100:+.2f}%）"}
    except Exception:
        return {"flag": False, "msg": ""}


def _check_liquidity(df: pd.DataFrame) -> tuple[bool, str]:
    if len(df) < 20:
        return False, "資料不足 20 日"
    vol_ma20 = float(df["Volume"].rolling(20).mean().iloc[-1])
    if vol_ma20 < 1_000_000:
        return False, f"流動性不足（均量 {vol_ma20/1000:.0f} 張）"
    return True, "ok"


# ──────────────────────────────────────────
# Module 2：技術指標
# ──────────────────────────────────────────

def _get_stock_data(ticker_tw: str, period: str = "120d", interval: str = "1d") -> pd.DataFrame | None:
    """用 Ticker.history() 下載台股資料，比 download() 更可靠。"""
    try:
        t = yf.Ticker(f"{ticker_tw}.TW")
        df = t.history(period=period, interval=interval, auto_adjust=True)
        if df is None or df.empty:
            return None
        df = df[["Close", "High", "Low", "Volume"]].copy()
        df.dropna(inplace=True)
        return df
    except Exception:
        return None


def _calc_zscore(df: pd.DataFrame) -> float | None:
    if len(df) < 20:
        return None
    close = df["Close"]
    ma20 = close.rolling(20).mean()
    std20 = close.rolling(20).std()
    last_std = float(std20.iloc[-1])
    if last_std == 0 or np.isnan(last_std):
        return None
    return round((float(close.iloc[-1]) - float(ma20.iloc[-1])) / last_std, 4)


def _calc_td_sequential(df: pd.DataFrame) -> int:
    close = df["Close"].values
    n = len(close)
    if n < 5:
        return 0
    count = 0
    for i in range(4, n):
        diff = close[i] - close[i - 4]
        if diff > 0:
            count = max(count + 1, 1) if count >= 0 else 1
        elif diff < 0:
            count = min(count - 1, -1) if count <= 0 else -1
        else:
            count = 0
        count = max(-9, min(9, count))
    return int(count)


def _calc_avwap(df: pd.DataFrame) -> float | None:
    """AVWAP 錨點：近 60 日最低低點。"""
    if len(df) < 20:
        return None
    lookback = min(60, len(df))
    low_series = df["Low"].iloc[-lookback:]
    anchor_label = low_series.idxmin()
    anchor_pos = df.index.get_loc(anchor_label)

    seg_tp = ((df["High"].values + df["Low"].values + df["Close"].values) / 3)[anchor_pos:]
    seg_volume = df["Volume"].values[anchor_pos:]
    cum_vol = np.cumsum(seg_volume)
    if cum_vol[-1] == 0:
        return None
    avwap = np.cumsum(seg_tp * seg_volume) / cum_vol
    return round(float(avwap[-1]), 2)


def _calc_rsi(df: pd.DataFrame, period: int = 14) -> float | None:
    """RSI (14)，Wilder 平滑法。"""
    if len(df) < period + 1:
        return None
    close = df["Close"]
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = (-delta).clip(lower=0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    last_loss = float(avg_loss.iloc[-1])
    if last_loss == 0:
        return 100.0
    rs = float(avg_gain.iloc[-1]) / last_loss
    return round(100 - 100 / (1 + rs), 2)


def _calc_atr(df: pd.DataFrame, period: int = 14) -> float | None:
    """ATR (14)，Wilder RMA 平滑。"""
    if len(df) < period + 1:
        return None
    high = df["High"]
    low = df["Low"]
    close = df["Close"]
    prev_close = close.shift(1)
    tr = pd.concat([
        high - low,
        (high - prev_close).abs(),
        (low - prev_close).abs(),
    ], axis=1).max(axis=1)
    atr = tr.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    val = float(atr.iloc[-1])
    return round(val, 4) if not np.isnan(val) else None


def _calc_macd(df: pd.DataFrame) -> dict | None:
    """MACD (12, 26, 9)。回傳最後兩根 hist 用於空中加油偵測。"""
    if len(df) < 35:
        return None
    close = df["Close"]
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    histogram = macd_line - signal_line
    return {
        "line": round(float(macd_line.iloc[-1]), 4),
        "hist": round(float(histogram.iloc[-1]), 4),
        "hist_prev": round(float(histogram.iloc[-2]), 4),
    }


def _calc_emas(df: pd.DataFrame) -> dict | None:
    """EMA 8/21/55。回傳最後兩根 ema8/ema21 用於交叉偵測。"""
    if len(df) < 56:
        return None
    close = df["Close"]
    ema8 = close.ewm(span=8, adjust=False).mean()
    ema21 = close.ewm(span=21, adjust=False).mean()
    ema55 = close.ewm(span=55, adjust=False).mean()
    return {
        "ema8": round(float(ema8.iloc[-1]), 2),
        "ema21": round(float(ema21.iloc[-1]), 2),
        "ema55": round(float(ema55.iloc[-1]), 2),
        "ema8_prev": round(float(ema8.iloc[-2]), 2),
        "ema21_prev": round(float(ema21.iloc[-2]), 2),
    }


# ──────────────────────────────────────────
# Module 3：FinMind 投信籌碼
# ──────────────────────────────────────────

def _get_institution_net_buy(stock_id: str) -> int | None:
    if not FINMIND_TOKEN:
        return None
    end_date = datetime.date.today().isoformat()
    start_date = (datetime.date.today() - datetime.timedelta(days=14)).isoformat()
    params = {
        "dataset": "TaiwanStockInstitutionalInvestorsBuySell",
        "data_id": stock_id,
        "start_date": start_date,
        "end_date": end_date,
        "token": FINMIND_TOKEN,
    }
    try:
        resp = requests.get(FINMIND_URL, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        time.sleep(1)
        if data.get("status") != 200 or not data.get("data"):
            return None
        df = pd.DataFrame(data["data"])
        df = df[df["name"] == "Investment_Trust"]
        if df.empty:
            return None
        df = df.sort_values("date").tail(5)
        return int(df["buy"].astype(int).sum() - df["sell"].astype(int).sum())
    except Exception:
        return None


# ──────────────────────────────────────────
# Module 5：決策引擎（得分制）
# ──────────────────────────────────────────
#
# 得分表（多空各自累加，最後取代數和）：
#
# 多方指標                 空方指標
# Z ≤ -2.0   : +3         Z ≥ 2.5     : -3
# Z ≤ -1.5   : +2         Z ≥ 2.0     : -2
# TD = -9    : +3         TD = 9      : -3
# TD = -8    : +2         TD = 8      : -2
# RSI ≤ 30   : +2         RSI ≥ 75    : -2
# RSI ≤ 40   : +1         RSI ≥ 70    : -1
# MACD空中加油: +2         EMA死亡交叉  : -2
# EMA黃金交叉 : +2         close<EMA55 : -1
# close>EMA55: +1         投信淨賣     : -1
# 投信淨買   : +2
# AVWAP≤1.5% : +1
# RR ≥ 2.5   : +1
# RR ≥ 4.0   : +1（加分）
#
# 訊號閾值：
#  ≥ 8  → 滿分買進
#  5~7  → 強烈買進 / 九轉買點 / 波段起漲 / 動能噴發（依主因命名）
#  3~4  → 九轉買點 / 波段起漲 / 動能噴發 / 支撐確認（依主因命名）
# -2~2  → 觀察中
# -3~-4 → 九轉賣點 / 波段轉弱（依主因命名）
#  ≤ -5 → 強烈賣出

def _calc_score_and_signal(
    z: float | None,
    td: int,
    net_buy: int | None,
    close: float,
    avwap: float | None,
    rsi: float | None,
    macd: dict | None,
    emas: dict | None,
    rr_ratio: float | None,
) -> tuple[int, str]:
    """
    計算綜合得分，並依得分 + 主因輸出訊號。
    回傳 (score, signal_str)。
    """
    score = 0

    # ── Z-Score ───────────────────────────
    if z is not None:
        if z <= -2.0:   score += 3
        elif z <= -1.5: score += 2
        elif z >= 2.5:  score -= 3
        elif z >= 2.0:  score -= 2

    # ── TD Sequential ─────────────────────
    if td == -9:        score += 3
    elif td == -8:      score += 2
    elif td == 9:       score -= 3
    elif td == 8:       score -= 2

    # ── RSI ───────────────────────────────
    if rsi is not None:
        if rsi <= 30:       score += 2
        elif rsi <= 40:     score += 1
        elif rsi >= 75:     score -= 2
        elif rsi >= 70:     score -= 1

    # ── 輔助指標（需 EMA/MACD/AVWAP/RR）────
    golden_cross = False
    death_cross  = False
    above_ema55  = False
    below_ema55  = False
    if emas is not None:
        golden_cross = emas["ema8_prev"] <= emas["ema21_prev"] and emas["ema8"] > emas["ema21"]
        death_cross  = emas["ema8_prev"] >= emas["ema21_prev"] and emas["ema8"] < emas["ema21"]
        above_ema55  = close > emas["ema55"]
        below_ema55  = close < emas["ema55"]
        if golden_cross: score += 2
        if death_cross:  score -= 2
        if above_ema55:  score += 1
        if below_ema55:  score -= 1

    macd_refueling = (
        macd is not None
        and macd["line"] > 0
        and macd["hist_prev"] <= 0
        and macd["hist"] > 0
    )
    if macd_refueling: score += 2

    avwap_ok   = avwap is not None and abs(close / avwap - 1) <= 0.015
    avwap_near = avwap is not None and abs(close / avwap - 1) <= 0.02 and close > avwap
    if avwap_ok:   score += 1

    if net_buy is not None:
        if net_buy > 0:  score += 2
        elif net_buy < 0: score -= 1

    if rr_ratio is not None:
        if rr_ratio >= 4.0: score += 2  # 包含 ≥2.5 的基礎分
        elif rr_ratio >= 2.5: score += 1

    # ── 訊號命名 ──────────────────────────
    if z is None and avwap is None:
        return score, "資料不足"

    if score >= 8:
        return score, "滿分買進"

    if score >= 5:
        # 依主因命名
        if td <= -9 and rsi is not None and rsi <= 40:
            return score, "九轉買點"
        if golden_cross and above_ema55:
            return score, "波段起漲"
        if macd_refueling:
            return score, "動能噴發"
        return score, "強烈買進"

    if score >= 3:
        if td <= -9:
            return score, "九轉買點"
        if golden_cross:
            return score, "波段起漲"
        if macd_refueling:
            return score, "動能噴發"
        if avwap_near:
            return score, "支撐確認"
        return score, "觀察中"

    if score <= -5:
        return score, "強烈賣出"

    if score <= -3:
        if td >= 9 and rsi is not None and rsi >= 70:
            return score, "九轉賣點"
        if death_cross:
            return score, "波段轉弱"
        return score, "觀察中"   # score -3/-4 無特定訊號 → 輕度偏空，不觸發強烈賣出

    return score, "觀察中"


def scan_ticker(ticker: str) -> dict:
    """掃描單一標的，回傳指標 dict。"""
    base: dict = {
        "ticker": ticker,
        "name": TW_STOCK_NAMES.get(ticker, ""),
        "close": None,
        "avwap": None,
        "net_buy": None,
        "zscore": None,
        "td_count": None,
        "rsi": None,
        "atr": None,
        "stop_loss": None,
        "rr_ratio": None,
        "ema8": None,
        "ema21": None,
        "macd_hist": None,
        "score": None,
        "signal": None,
        "error": None,
    }
    df = _get_stock_data(ticker)
    if df is None or df.empty:
        base["error"] = "取資料失敗"
        base["signal"] = "取資料失敗"
        return base

    liq_ok, liq_msg = _check_liquidity(df)
    if not liq_ok:
        base["error"] = liq_msg
        base["signal"] = liq_msg
        return base

    close = round(float(df["Close"].iloc[-1]), 2)
    z     = _calc_zscore(df)
    td    = _calc_td_sequential(df)
    avwap = _calc_avwap(df)
    rsi   = _calc_rsi(df)
    atr   = _calc_atr(df)
    macd  = _calc_macd(df)
    emas  = _calc_emas(df)
    net_buy = _get_institution_net_buy(ticker)

    stop_loss: float | None = round(close - 2 * atr, 2) if atr is not None else None

    rr_ratio: float | None = None
    if atr is not None and atr > 0 and len(df) >= 20:
        recent_high = float(df["High"].iloc[-20:].max())
        rr_ratio = round((recent_high - close) / (2 * atr), 2)

    score, signal = _calc_score_and_signal(
        z, td, net_buy, close, avwap, rsi, macd, emas, rr_ratio
    )

    base.update({
        "close": close,
        "avwap": avwap,
        "net_buy": net_buy,
        "zscore": z,
        "td_count": td,
        "rsi": rsi,
        "atr": atr,
        "stop_loss": stop_loss,
        "rr_ratio": rr_ratio,
        "ema8": emas["ema8"] if emas else None,
        "ema21": emas["ema21"] if emas else None,
        "macd_hist": macd["hist"] if macd else None,
        "score": score,
        "signal": signal,
    })
    return base


def run_scan(tickers: list[str]) -> dict:
    """
    掃描整批標的。
    回傳：{systemic_risk, systemic_msg, scanned_at, results[]}
    """
    systemic = check_systemic_risk()
    results_map: dict[str, dict] = {}

    def scan_safe(t: str) -> dict:
        try:
            return scan_ticker(t)
        except Exception as e:
            return {"ticker": t, "error": str(e), "score": None, "signal": "錯誤"}

    with ThreadPoolExecutor(max_workers=min(len(tickers), 6)) as executor:
        futures = {executor.submit(scan_safe, t): t for t in tickers}
        for future in as_completed(futures):
            try:
                r = future.result(timeout=30)
                results_map[r["ticker"]] = r
            except Exception:
                pass

    # 保持原始順序
    results = [results_map.get(t, {"ticker": t, "error": "逾時", "score": None, "signal": "錯誤"}) for t in tickers]

    return {
        "systemic_risk": systemic["flag"],
        "systemic_msg": systemic["msg"],
        "scanned_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "results": results,
    }


# ──────────────────────────────────────────
# 圖表資料端點
# ──────────────────────────────────────────

def get_chart_data(ticker: str, interval: str) -> dict:
    """
    取得圖表原始 OHLCV 資料，含大盤 ^TWII（用於 RS Line）。
    interval: "1d" → 6 個月；"1h" → 60 天；"1m" → 7 天
    使用 Ticker.history() 以取得更可靠的台股資料。
    """
    period_map = {"1d": "6mo", "1h": "60d", "1m": "7d"}
    period = period_map.get(interval, "6mo")

    ticker_yf = f"{ticker}.TW"
    name = TW_STOCK_NAMES.get(ticker, "")

    def dl_stock():
        return yf.Ticker(ticker_yf).history(period=period, interval=interval, auto_adjust=True)

    def dl_market():
        return yf.Ticker("^TWII").history(period=period, interval=interval, auto_adjust=True)

    # 並行下載，各設 25s timeout
    with ThreadPoolExecutor(max_workers=2) as ex:
        f_stock = ex.submit(dl_stock)
        f_mkt = ex.submit(dl_market)
        try:
            df = f_stock.result(timeout=25)
        except Exception as e:
            return {"data": [], "name": name, "error": str(e)}
        try:
            mdf = f_mkt.result(timeout=25)
        except Exception:
            mdf = None

    if df is None or df.empty:
        return {"data": [], "name": name, "error": f"無法取得 {ticker} 資料"}
    try:
        df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
        df.dropna(subset=["Close"], inplace=True)
    except Exception as e:
        return {"data": [], "name": name, "error": str(e)}

    # 大盤資料 for RS Line
    try:
        market_series = mdf["Close"].dropna() if (mdf is not None and not mdf.empty) else pd.Series(dtype=float)
    except Exception:
        market_series = pd.Series(dtype=float)

    # 時間戳正規化：日K 取日期字串，盤中取台灣時間字串
    def _ts_key(ts) -> str:
        try:
            if interval == "1d":
                # .date() 直接取本地日期，不受 tz-aware/tz-naive 影響
                return ts.date().isoformat()
            else:
                # 盤中：轉成台灣時間
                if hasattr(ts, "tz_convert") and ts.tzinfo is not None:
                    return ts.tz_convert("Asia/Taipei").strftime("%Y-%m-%d %H:%M")
                return ts.strftime("%Y-%m-%d %H:%M")
        except Exception:
            s = str(ts)
            return s[:10] if interval == "1d" else s[:16]

    market_map: dict = {_ts_key(ts): float(val) for ts, val in market_series.items()}

    points = []
    for ts, row in df.iterrows():
        # 顯示時間字串（台灣時區）
        if interval == "1d":
            time_str = ts.date().isoformat()
        else:
            try:
                if hasattr(ts, "tz_convert") and ts.tzinfo is not None:
                    dt_tw = ts.tz_convert("Asia/Taipei")
                elif ts.tzinfo is None:
                    dt_tw = ts.tz_localize("UTC").tz_convert("Asia/Taipei")
                else:
                    dt_tw = ts
                time_str = dt_tw.strftime("%m-%d %H:%M")
            except Exception:
                time_str = str(ts)[:16]

        close_val = float(row["Close"]) if not pd.isna(row["Close"]) else None
        market_close = market_map.get(_ts_key(ts))

        points.append({
            "time": time_str,
            "price": round(close_val, 2) if close_val is not None else None,
            "open":  round(float(row["Open"]),   2) if not pd.isna(row["Open"])   else None,
            "high":  round(float(row["High"]),   2) if not pd.isna(row["High"])   else None,
            "low":   round(float(row["Low"]),    2) if not pd.isna(row["Low"])    else None,
            "close": round(close_val, 2) if close_val is not None else None,
            "volume": int(row["Volume"]) if not pd.isna(row["Volume"]) else 0,
            "marketClose": round(market_close, 2) if market_close is not None else None,
        })

    points = [p for p in points if p["price"] is not None]
    return {"data": points, "name": name, "error": None}


# ──────────────────────────────────────────
# 一鍵尋股（Screener）
# ──────────────────────────────────────────

SCREENER_TICKERS = [
    # ETF
    "0050", "0056",
    # 半導體
    "2330", "2454", "3711", "3034", "2344", "3008", "6488", "2337", "6415",
    # PC / 伺服器 / 零組件
    "2317", "2382", "2357", "4938", "2376", "2377", "3231", "2353",
    # 電子製造 / 被動元件
    "2308", "2301", "2395", "2379", "6669", "2474", "3702",
    # 網路 / 通訊
    "2412", "3045", "4904",
    # 金融
    "2882", "2881", "2886", "2891", "2892", "2884", "2885", "5880",
    # 石化 / 基材
    "1301", "1303", "1326", "6505",
    # 水泥 / 鋼鐵
    "1101", "1102", "2002",
    # 航運
    "2603", "2609", "2615",
    # 消費 / 零售
    "2912", "2207", "1216",
]


# ──────────────────────────────────────────
# 新聞查詢
# ──────────────────────────────────────────

def get_stock_news(ticker: str, limit: int = 8) -> dict:
    """
    查詢個股相關新聞。
    優先使用 yfinance .news；若不足，補充 Google News RSS。
    回傳 {"news": [{title, link, publisher, time_str}], "error": null}
    """
    import xml.etree.ElementTree as ET

    news_items: list[dict] = []

    # ── 來源 1：yfinance news ──────────────────
    try:
        t = yf.Ticker(f"{ticker}.TW")
        raw = t.news or []
        for item in raw[:limit]:
            # yfinance 0.2.x 結構：item["content"]["title"] / item["content"]["canonicalUrl"]["url"]
            # 或舊版：item["title"] / item["link"]
            content = item.get("content") or {}
            title     = content.get("title") or item.get("title", "")
            link_obj  = content.get("canonicalUrl") or {}
            link      = link_obj.get("url") if isinstance(link_obj, dict) else None
            link      = link or item.get("link", "") or item.get("url", "")
            publisher = content.get("provider", {}).get("displayName") if isinstance(content.get("provider"), dict) else None
            publisher = publisher or item.get("publisher", "")
            pub_ts    = content.get("pubDate") or item.get("providerPublishTime")
            if pub_ts:
                try:
                    if isinstance(pub_ts, (int, float)):
                        pub_ts_dt = datetime.datetime.fromtimestamp(int(pub_ts))
                    else:
                        pub_ts_dt = datetime.datetime.fromisoformat(str(pub_ts).replace("Z", "+00:00"))
                    time_str = pub_ts_dt.strftime("%Y-%m-%d %H:%M")
                except Exception:
                    time_str = str(pub_ts)[:16]
            else:
                time_str = ""
            if title and link:
                news_items.append({
                    "title": title,
                    "link": link,
                    "publisher": publisher,
                    "time_str": time_str,
                    "source": "yfinance",
                })
    except Exception:
        pass

    # ── 來源 2：Google News RSS（補充至 limit 筆）──
    if len(news_items) < limit:
        name = TW_STOCK_NAMES.get(ticker, "")
        query = f"{ticker} {name}".strip() if name else ticker
        rss_url = f"https://news.google.com/rss/search?q={requests.utils.quote(query)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
        try:
            resp = requests.get(rss_url, timeout=10,
                                headers={"User-Agent": "Mozilla/5.0 (compatible)"})
            resp.raise_for_status()
            root = ET.fromstring(resp.content)
            for item in root.iter("item"):
                if len(news_items) >= limit:
                    break
                title   = (item.findtext("title") or "").strip()
                link    = (item.findtext("link")  or "").strip()
                pub_raw = item.findtext("pubDate") or ""
                try:
                    from email.utils import parsedate_to_datetime
                    pub_dt   = parsedate_to_datetime(pub_raw)
                    time_str = pub_dt.strftime("%Y-%m-%d %H:%M")
                except Exception:
                    time_str = pub_raw[:16]
                publisher = "Google 新聞"
                # 略過重複
                if any(n["title"] == title for n in news_items):
                    continue
                if title and link:
                    news_items.append({
                        "title": title,
                        "link": link,
                        "publisher": publisher,
                        "time_str": time_str,
                        "source": "google_news",
                    })
        except Exception:
            pass

    if not news_items:
        return {"news": [], "error": "查無新聞"}
    return {"news": news_items[:limit], "error": None}


def run_screener(min_score: int = 5) -> dict:
    """
    平行掃描 SCREENER_TICKERS，回傳得分 >= min_score 的標的（按得分排序）。
    """
    def scan_safe(t: str) -> dict:
        try:
            return scan_ticker(t)
        except Exception as e:
            return {"ticker": t, "error": str(e), "score": None, "signal": "錯誤"}

    results = []
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(scan_safe, t): t for t in SCREENER_TICKERS}
        for future in as_completed(futures):
            try:
                r = future.result(timeout=20)
                if r.get("score") is not None and r["score"] >= min_score:
                    results.append(r)
            except Exception:
                pass

    return {
        "results": sorted(results, key=lambda r: r.get("score") or 0, reverse=True),
        "total_scanned": len(SCREENER_TICKERS),
        "scanned_at": datetime.datetime.now().isoformat(timespec="seconds"),
    }
