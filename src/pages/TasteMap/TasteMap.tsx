import { useState, useEffect } from 'react'
import Hero from './Hero'
import Grid from './Grid'
import DetailModal from './DetailModal'
import { Recommendation, SearchResult } from '../../types'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function TasteMap() {
    const [selectedItem, setSelectedItem] = useState<Recommendation | null>(null)
    const [recommendations, setRecommendations] = useState<Recommendation[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const [currentKeyword, setCurrentKeyword] = useState('')

    useEffect(() => {
        fetchRecommendations(`${API_BASE}/api/recommendations`)
    }, [])

    const fetchRecommendations = (url: string) => {
        setLoading(true)
        setHasMore(false)
        setCurrentPage(1)
        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setRecommendations(data)
                    setHasMore(false)
                } else {
                    setRecommendations(data.results || [])
                    setHasMore(data.has_more || false)
                    setCurrentPage(data.page || 1)
                }
                setLoading(false)
            })
            .catch(err => {
                console.error('Failed to fetch recommendations:', err)
                setLoading(false)
            })
    }

    const handleSearch = (keyword) => {
        setCurrentKeyword(keyword)
        fetchRecommendations(`${API_BASE}/api/search?q=${encodeURIComponent(keyword)}`)
    }

    const handleLoadMore = () => {
        if (!currentKeyword || loadingMore) return
        const nextPage = currentPage + 1
        setLoadingMore(true)

        fetch(`${API_BASE}/api/search?q=${encodeURIComponent(currentKeyword)}&page=${nextPage}`)
            .then(res => res.json())
            .then(data => {
                const newResults = data.results || []
                setRecommendations(prev => [...prev, ...newResults])
                setHasMore(data.has_more || false)
                setCurrentPage(nextPage)
                setLoadingMore(false)
            })
            .catch(err => {
                console.error('Failed to load more:', err)
                setLoadingMore(false)
            })
    }

    return (
        <div style={{ paddingTop: '64px' }}>
            <Hero onSearch={handleSearch} />
            <Grid
                onCardClick={setSelectedItem}
                recommendations={recommendations}
                loading={loading}
                loadingMore={loadingMore}
                hasMore={hasMore}
                onLoadMore={handleLoadMore}
            />
            <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
        </div>
    )
}
