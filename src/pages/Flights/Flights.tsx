import { Link } from 'react-router-dom'
import '../Placeholder.css'

export default function Flights() {
    return (
        <div className="placeholder-page">
            <span className="placeholder-icon">✈️</span>
            <h2>機票搜尋</h2>
            <p>搜尋最優惠的機票，比較不同航空公司的價格與時段。</p>
            <span className="placeholder-badge">⏳ 即將推出</span>
            <Link
                to="/"
                className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] font-semibold text-[0.95rem] hover:bg-[var(--bg-card-hover)] hover:border-[var(--accent-gold)] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10 focus-visible:outline-2 focus-visible:outline-[var(--accent-gold)] focus-visible:outline-offset-2 transition-all duration-200"
                aria-label="返回首頁"
            >
                ← 返回首頁
            </Link>
        </div>
    )
}
