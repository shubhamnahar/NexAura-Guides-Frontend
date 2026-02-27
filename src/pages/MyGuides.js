// src/pages/MyGuides.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { endpoints } from '../services/api';
import GuideCard from '../components/GuideCard/GuideCard';
import '../styles/pages/Page.css';

const MyGuides = () => {
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { token } = useAuth();

  useEffect(() => {
    const fetchGuides = async () => {
      if (!token) {
        setError('You must be logged in to see your guides.');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(endpoints.guides.base, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

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
    };

    fetchGuides();
  }, [token]);

  // Delete a guide
  const handleDeleteGuide = async (guideId) => {
    setError('');

    try {
      const response = await fetch(
        endpoints.guides.detail(guideId),
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
          const err = await response.json();
          throw new Error(err.detail);
        }
        throw new Error('Failed to delete guide. Please try again.');
      }

      setGuides((currentGuides) =>
        currentGuides.filter((guide) => guide.id !== guideId)
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const buildPdfName = (guide) => {
    const fallback = `guide_${guide?.id ?? 'download'}`;
    const raw = (guide?.name || fallback).trim();
    const underscored = raw.replace(/\s+/g, '_');
    const safe = underscored.replace(/[^A-Za-z0-9._-]/g, '') || fallback;
    return `${safe}.pdf`;
  };

  // Download a guide as PDF
  const handleDownloadGuide = async (guide) => {
    setError('');

    const guideId = guide?.id;
    if (!guideId) {
      setError('Missing guide id for download.');
      return;
    }

    try {
      const response = await fetch(
        endpoints.guides.exportPdf(guideId),
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const maybeJson = await response
          .json()
          .catch(() => ({ detail: 'Failed to download PDF' }));
        throw new Error(maybeJson.detail || 'Failed to download PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = buildPdfName(guide);
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page-container">
      <div className="container">
        <h1 className="page-title">My Guides</h1>
        {loading && <p>Loading...</p>}
        {error && <p className="page-error">{error}</p>}

        <div className="guide-grid">
          {!loading && !error && guides.length === 0 && (
            <p>
              You haven&apos;t created any guides yet. Try creating one with the
              extension!
            </p>
          )}
          {guides.map((guide) => (
            <GuideCard
              key={guide.id}
              guide={guide}
              showDelete={true}
              onDelete={handleDeleteGuide}
              showDownload={true}
              onDownload={handleDownloadGuide}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default MyGuides;
