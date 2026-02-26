import { Link } from 'react-router-dom'
import './Home.css'

const FEATURES = [
    {
        icon: '🗺️',
        title: 'TasteMap TW',
        desc: '跟隨頂級網紅的腳步，探索全球 35+ 城市的美食推薦。',
        to: '/tastemap',
        accent: 'var(--accent-gold)',
        ready: true,
    },
    {
        icon: '✈️',
        title: '機票搜尋',
        desc: '搜尋最優惠的機票，比較不同航空公司的價格。',
        to: '/flights',
        accent: 'var(--accent-blue)',
        ready: false,
    },
    {
        icon: '💪',
        title: '健身紀錄',
        desc: '記錄每天的訓練組數、重量與進步軌跡。',
        to: '/gym',
        accent: 'var(--accent-green)',
        ready: false,
    },
    {
        icon: '🎙️',
        title: 'MeetNote',
        desc: '上傳錄音檔，自動轉逐字稿並產生會議摘要。',
        to: '/meetnote',
        accent: 'var(--accent-purple)',
        ready: false,
    },
]

export default function Home() {
    return (
        <div className="home">
            <header className="home-header">
                <h1>CC Workspace</h1>
                <p>你的個人多功能工具站</p>
            </header>

            <div className="feature-grid">
                {FEATURES.map(({ icon, title, desc, to, accent, ready }) => (
                    <Link
                        key={to}
                        to={to}
                        className="feature-card"
                        style={{ '--card-accent': accent }}
                    >
                        <span className="feature-icon">{icon}</span>
                        <h3>{title}</h3>
                        <p>{desc}</p>
                        <span className={`feature-badge ${ready ? 'ready' : 'coming'}`}>
                            {ready ? '✓ 已上線' : '⏳ 開發中'}
                        </span>
                    </Link>
                ))}
            </div>
        </div>
    )
}
