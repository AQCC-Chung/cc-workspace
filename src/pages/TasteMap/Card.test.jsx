import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Card from './Card';

describe('Card Component', () => {
    const mockData = {
        name: 'Test Restaurant',
        image: 'test-image.jpg',
        category: 'Japanese',
        rating: 4.5,
        location: 'Taipei',
        price_range: '$$',
        quote: 'Delicious!',
        influencer: 'Chef John',
        article_url: 'https://example.com/article'
    };

    const mockOnClick = vi.fn();

    it('renders card with correct data', () => {
        render(<Card data={mockData} onClick={mockOnClick} />);

        expect(screen.getByText('Test Restaurant')).toBeInTheDocument();
        expect(screen.getByText('Japanese')).toBeInTheDocument();
        expect(screen.getByText('★ 4.5')).toBeInTheDocument();
        expect(screen.getByText(/Taipei/)).toBeInTheDocument();
        expect(screen.getByText(/\$\$/)).toBeInTheDocument();
        expect(screen.getByText('"Delicious!"')).toBeInTheDocument();
        expect(screen.getByText('📝 Chef John')).toBeInTheDocument();

        const img = screen.getByAltText('Test Restaurant');
        expect(img).toHaveAttribute('src', 'test-image.jpg');
    });

    it('renders default influencer name if not provided', () => {
        const dataWithoutInfluencer = { ...mockData, influencer: '' };
        render(<Card data={dataWithoutInfluencer} onClick={mockOnClick} />);

        expect(screen.getByText('📝 網路推薦')).toBeInTheDocument();
    });

    it('calls onClick when card is clicked', () => {
        render(<Card data={mockData} onClick={mockOnClick} />);

        fireEvent.click(screen.getByRole('heading', { name: /Test Restaurant/i }).closest('.card'));
        expect(mockOnClick).toHaveBeenCalledWith(mockData);
    });

    it('stops propagation and opens window when influencer link is clicked', () => {
        const windowSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
        render(<Card data={mockData} onClick={mockOnClick} />);

        const influencerLink = screen.getByText(/Chef John/);
        fireEvent.click(influencerLink);

        expect(windowSpy).toHaveBeenCalledWith('https://example.com/article', '_blank');
        expect(mockOnClick).not.toHaveBeenCalled();

        windowSpy.mockRestore();
    });

    it('stops propagation but does not open window if article_url is missing', () => {
        const windowSpy = vi.spyOn(window, 'open').mockImplementation(() => {});
        const dataWithoutUrl = { ...mockData, article_url: '' };
        render(<Card data={dataWithoutUrl} onClick={mockOnClick} />);

        const influencerLink = screen.getByText(/Chef John/);
        fireEvent.click(influencerLink);

        expect(windowSpy).not.toHaveBeenCalled();
        expect(mockOnClick).not.toHaveBeenCalled();

        windowSpy.mockRestore();
    });
});
