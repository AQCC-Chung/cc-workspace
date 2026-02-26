export interface Recommendation {
    id?: number;
    name: string;
    category: string;
    image?: string;
    influencer?: string;
    quote?: string;
    rating?: number;
    user_ratings_total?: number;
    price_range?: string;
    location?: string;
    source_url?: string;
    article_url?: string;
    address?: string;
}

export interface SearchResult {
    results: Recommendation[];
    has_more: boolean;
    page: number;
}
