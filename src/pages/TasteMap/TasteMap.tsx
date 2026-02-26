import { useState } from 'react'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import Hero from './Hero'
import Grid from './Grid'
import DetailModal from './DetailModal'
import { Recommendation, SearchResult } from '../../types'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function TasteMap() {
    const [selectedItem, setSelectedItem] = useState<Recommendation | null>(null)
    const [currentKeyword, setCurrentKeyword] = useState<string>('')

    // Default recommendations
    const recsQuery = useQuery({
        queryKey: ['recommendations'],
        queryFn: async () => {
            const res = await fetch(`${API_BASE}/api/recommendations`)
            if (!res.ok) throw new Error('Network response was not ok')
            return res.json() as Promise<Recommendation[]>
        },
        enabled: !currentKeyword,
        staleTime: 1000 * 60 * 5, // 5 minutes
    })

    // Search results
    const searchQuery = useInfiniteQuery({
        queryKey: ['search', currentKeyword],
        queryFn: async ({ pageParam }) => {
            const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(currentKeyword)}&page=${pageParam}`)
            if (!res.ok) throw new Error('Network response was not ok')
            return res.json() as Promise<SearchResult>
        },
        initialPageParam: 1,
        getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.page + 1 : undefined,
        enabled: !!currentKeyword,
        staleTime: 1000 * 60 * 5,
    })

    const recommendations = currentKeyword
        ? searchQuery.data?.pages.flatMap(page => page.results) || []
        : recsQuery.data || []

    const loading = currentKeyword
        ? searchQuery.isLoading
        : recsQuery.isLoading

    return (
        <div style={{ paddingTop: '64px' }}>
            <Hero onSearch={setCurrentKeyword} />
            <Grid
                onCardClick={setSelectedItem}
                recommendations={recommendations}
                loading={loading}
                loadingMore={searchQuery.isFetchingNextPage}
                hasMore={!!searchQuery.hasNextPage}
                onLoadMore={() => searchQuery.fetchNextPage()}
            />
            <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
        </div>
    )
}
