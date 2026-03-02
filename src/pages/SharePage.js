// src/pages/SharePage.js
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { endpoints } from '../services/api';
import '../styles/pages/Page.css';

const SharePage = () => {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token');
  const { token: authToken, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState('processing'); // 'processing', 'success', 'error'
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;

    if (!tokenFromUrl) {
      setStatus('error');
      setError('Invalid or missing share token.');
      return;
    }

    if (!authToken) {
      setStatus('error');
      setError('You must be logged in to claim access to this guide.');
      return;
    }

    const claimAccess = async () => {
      try {
        const response = await fetch(endpoints.guides.claimAccess(tokenFromUrl), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.detail || 'Failed to claim access to the guide.');
        }

        setStatus('success');
        // Redirect after a short delay
        setTimeout(() => {
          navigate('/my-guides');
        }, 2000);
      } catch (err) {
        setStatus('error');
        setError(err.message);
      }
    };

    claimAccess();
  }, [tokenFromUrl, authToken, authLoading, navigate]);

  return (
    <div className="page-container">
      <div className="container" style={{ textAlign: 'center', marginTop: '100px' }}>
        {status === 'processing' && (
          <>
            <h1>Processing Share Link...</h1>
            <p>Please wait while we authorize your access.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 style={{ color: '#7cff9d' }}>Access Granted! ✅</h1>
            <p>You now have access to this guide. Redirecting to My Guides...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 style={{ color: '#ff8a8a' }}>Access Denied ❌</h1>
            <p className="page-error">{error}</p>
            {!authToken && (
              <div style={{ marginTop: '20px' }}>
                <Link to={`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`} className="cta-button primary">
                  Log In to Continue
                </Link>
              </div>
            )}
            <div style={{ marginTop: '20px' }}>
              <Link to="/explore" style={{ color: 'var(--brand-orange)' }}>Explore Public Guides</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SharePage;
