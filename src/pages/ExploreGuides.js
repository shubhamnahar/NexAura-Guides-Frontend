// src/pages/ExploreGuides.js
import React, { useState, useEffect, useCallback } from 'react';
import GuideCard from '../components/GuideCard';
import './Page.css'; 

const ExploreGuides = () => {
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // We use useCallback to make sure this function doesn't
  // change on every render, preventing useEffect loops
  const fetchGuides = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      // Pass the search term as a URL query parameter
      const response = await fetch(`http://127.0.0.1:8000/api/guides/public?search=${searchTerm}`);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to fetch guides');
      }

      const data = await response.json();
      setGuides(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]); // Re-run this function only when searchTerm changes

  // Fetch guides on initial load
  useEffect(() => {
    fetchGuides();
  }, [fetchGuides]); 

  const handleSearch = (e) => {
    e.preventDefault();
    fetchGuides();
  };

  return (
    <div className="page-container">
      <div className="container">
        <h1 className="page-title">Explore All Guides</h1>

        <form onSubmit={handleSearch} className="search-form">
          <input 
            type="text"
            className="search-input"
            placeholder="Search by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit" className="cta-button primary">Search</button>
        </form>

        {loading && <p>Loading...</p>}
        {error && <p className="page-error">{error}</p>}
        
        <div className="guide-grid">
          {!loading && !error && guides.length === 0 && (
            <p>No guides found. Try a different search or create one!</p>
          )}
          {guides.map(guide => (
            <GuideCard key={guide.id} guide={guide} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ExploreGuides;