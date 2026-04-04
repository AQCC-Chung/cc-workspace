import { MouseEvent } from 'react';
import './Card.css';
import { Recommendation } from '../../types';

interface CardProps {
    data: Recommendation;
    onClick: (item: Recommendation) => void;
}

export default function Card({ data, onClick }: CardProps) {
    const handleSourceClick = (e: MouseEvent) => {
        e.stopPropagation();
        if (data.article_url) {
            // Security: Prevent reverse tabnabbing by adding noopener,noreferrer
            window.open(data.article_url, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <div className="card" onClick={() => onClick(data)}>
            <div className="card-image-wrapper">
                <img src={data.image} alt={data.name} className="card-image" />
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
}
