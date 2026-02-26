import Card from './Card';
import './Grid.css';
import { Recommendation } from '../../types';

interface GridProps {
    onCardClick: (item: Recommendation) => void;
    recommendations: Recommendation[];
    loading: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
}

export default function Grid({ onCardClick, recommendations, loading, loadingMore, hasMore, onLoadMore }: GridProps) {
    if (loading) {
        return (
            <div className="grid-container">
                <h2 className="grid-title">搜尋並載入最新資料中...</h2>
                <div className="loading-spinner">
                    <div className="spinner"></div>
                </div>
            </div>
        );
    }

    if (recommendations.length === 0) {
        return (
            <div className="grid-container">
                <h2 className="grid-title">找不到相關推薦，請嘗試其他關鍵字。</h2>
            </div>
        );
    }

    return (
        <div className="grid-container">
            <h2 className="grid-title">最新評測推薦</h2>
            <p className="grid-subtitle">共找到 {recommendations.length} 個推薦{hasMore ? '，還有更多' : ''}</p>
            <div className="masonry-grid">
                {recommendations.map((item, index) => (
                    <div key={item.id || `place-${index}`} className="grid-item">
                        <Card data={item} onClick={onCardClick} />
                    </div>
                ))}
            </div>

            {hasMore && (
                <div className="load-more-container">
                    <button
                        className="load-more-btn"
                        onClick={onLoadMore}
                        disabled={loadingMore}
                    >
                        {loadingMore ? (
                            <>
                                <span className="btn-spinner"></span>
                                載入更多中...
                            </>
                        ) : (
                            '載入更多推薦 →'
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
