import { useState } from 'react';
import './Hero.css';

export default function Hero({ onSearch }) {
  const [keyword, setKeyword] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (keyword.trim()) {
      onSearch(keyword.trim());
      // Scroll down to the grid results
      window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
    }
  };

  return (
    <div className="hero-container">
      <div className="hero-content">
        <h1>探索極致品味</h1>
        <p>跟隨頂級網紅的腳步，體驗最奢華的餐廳與秘境景點。</p>

        <form className="search-bar" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="輸入關鍵字，例如：信義區 餐酒館"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <button type="submit" className="search-button">
            搜尋
          </button>
        </form>

        <button className="cta-button" onClick={() => window.scrollBy({ top: window.innerHeight, behavior: 'smooth' })}>
          探索最新推薦
        </button>
      </div>
    </div>
  );
}
