import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import './Navbar.css'

const NAV_ITEMS = [
    { to: '/', icon: '🏠', label: '首頁' },
    { to: '/tastemap', icon: '🗺️', label: 'TasteMap' },
    { to: '/flights', icon: '✈️', label: '機票搜尋' },
    { to: '/gym', icon: '💪', label: 'FitTracker' },
    { to: '/meetnote', icon: '🎙️', label: 'MeetNote' },
    { to: '/stock', icon: '📈', label: '波段監控' },
]

export default function Navbar() {
    const [open, setOpen] = useState(false)

    return (
        <nav className="navbar">
            <NavLink to="/" className="navbar-brand">
                <span>⚡</span> CC Workspace
            </NavLink>

            <button
                className="navbar-toggle"
                onClick={() => setOpen(!open)}
                aria-label="Toggle menu"
            >
                {open ? '✕' : '☰'}
            </button>

            <ul className={`navbar-links ${open ? 'open' : ''}`}>
                {NAV_ITEMS.map(({ to, icon, label }) => (
                    <li key={to}>
                        <NavLink
                            to={to}
                            end={to === '/'}
                            onClick={() => setOpen(false)}
                        >
                            <span className="nav-icon">{icon}</span>
                            {label}
                        </NavLink>
                    </li>
                ))}
            </ul>
        </nav>
    )
}
