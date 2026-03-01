import { MouseEvent, memo } from 'react';
import './Card.css';
import { Recommendation } from '../../types';

interface CardProps {
    data: Recommendation;
    onClick: (item: Recommendation) => void;
}

// ⚡ Bolt Optimization:
// Wrapped Card in React.memo to prevent unnecessary re-renders when the parent Grid updates (e.g., when loading more items).
// Impact: Reduces React virtual DOM diffing overhead for unchanged cards in the grid.
const Card = memo(function Card({ data, onClick }: CardProps) {
    const handleSourceClick = (e: MouseEvent) => {
        e.stopPropagation();
        if (data.article_url) {
            window.open(data.article_url, '_blank');
        }
    };

    return (
        <div className="card" onClick={() => onClick(data)}>
            <div className="card-image-wrapper">
                {/* ⚡ Bolt Optimization: Added loading="lazy" to defer loading offscreen images.
                    Impact: Significantly reduces initial network payload and main thread blocking on page load. */}
                <img src={data.image} alt={data.name} className="card-image" loading="lazy" />
                <div className="card-overlay">
                    <span className="card-category">{data.category}</span>
                    <span className="card-rating">★ {data.rating}</span>
                </div>
            </div>
            <div className="card-content">
                <h3 className="card-title">{data.name}</h3>
                <p className="card-location">{data.location} • {data.price_range}</p>
                <div className="card-quote-wrapper">
                    <p className="card-quote">"{data.quote}"</p>
                    <span className="card-influencer" onClick={handleSourceClick} title="點擊查看原文">
                        📝 {data.influencer || '網路推薦'}
                    </span>
                </div>
            </div>
        </div>
    );
});

export default Card;
