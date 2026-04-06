import './DetailModal.css';
import { Recommendation } from '../../types';

interface DetailModalProps {
    item: Recommendation | null;
    onClose: () => void;
}

export default function DetailModal({ item, onClose }: DetailModalProps) {
    if (!item) return null;

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={onClose}>×</button>

                <div className="modal-image-container">
                    <img src={item.image} alt={item.name} className="modal-image" />
                    <div className="modal-image-overlay" />
                </div>

                <div className="modal-body">
                    <div className="modal-header">
                        <div>
                            <span className="modal-category">{item.category}</span>
                            <h2 className="modal-title">{item.name}</h2>
                        </div>
                        <div className="modal-rating">★ {item.rating}</div>
                    </div>

                    <div className="modal-info-bar">
                        <span>📍 {item.address || item.location}</span>
                        <span className="modal-price">💰 {item.price_range}</span>
                    </div>

                    <div className="modal-quote-section">
                        <svg className="quote-icon" width="24" height="24" viewBox="0 0 24 24" fill="var(--accent-gold)">
                            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                        </svg>
                        <p className="modal-quote">{item.quote}</p>
                        <a
                            className="modal-source-link"
                            href={item.article_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                        >
                            📝 來源：{item.influencer || '網路推薦'}
                        </a>
                    </div>

                    <div className="modal-actions">
                        <button className="btn-primary" onClick={() => window.open(item.source_url || `https://maps.google.com/?q=${item.name}+${item.location}`, '_blank', 'noopener,noreferrer')}>
                            🗺️ 在 Google Maps 上查看
                        </button>
                        {item.article_url && (
                            <button className="btn-article" onClick={() => window.open(item.article_url, '_blank', 'noopener,noreferrer')}>
                                📖 閱讀原文推薦
                            </button>
                        )}
                        <button className="btn-secondary" onClick={onClose}>
                            返回探索
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
