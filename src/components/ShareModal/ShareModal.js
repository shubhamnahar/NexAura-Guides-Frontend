import React, { useState, useEffect } from 'react';
import { endpoints } from '../../services/api';
import '../../styles/components/ShareModal.css';

const ShareModal = ({ guide, token, onClose, onUpdate }) => {
  const [emails, setEmails] = useState(guide.shared_emails || []);
  const [newEmail, setNewEmail] = useState('');
  const [isPublic, setIsPublic] = useState(guide.is_public || false);
  const [shareLink, setShareLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setEmails(guide.shared_emails || []);
    setIsPublic(guide.is_public || false);
    if (guide.share_token) {
      setShareLink(`${window.location.origin}/share?token=${guide.share_token}`);
    } else {
      setShareLink('');
    }
    setError('');
  }, [guide]);

  const handleTogglePublic = async () => {
    setError('');
    const updatedPublic = !isPublic;
    try {
      const response = await fetch(endpoints.guides.update(guide.id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_public: updatedPublic }),
      });

      if (!response.ok) throw new Error('Failed to update privacy settings');
      setIsPublic(updatedPublic);
      onUpdate && onUpdate({ ...guide, is_public: updatedPublic });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddEmail = async (e) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setError('');

    const updatedEmails = [...emails, newEmail.trim()];
    try {
      const response = await fetch(endpoints.guides.update(guide.id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shared_emails: updatedEmails }),
      });

      if (!response.ok) throw new Error('Failed to add email');
      setEmails(updatedEmails);
      setNewEmail('');
      onUpdate && onUpdate({ ...guide, shared_emails: updatedEmails });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemoveEmail = async (emailToRemove) => {
    setError('');
    const updatedEmails = emails.filter(e => e !== emailToRemove);
    try {
      const response = await fetch(endpoints.guides.update(guide.id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ shared_emails: updatedEmails }),
      });

      if (!response.ok) throw new Error('Failed to remove email');
      setEmails(updatedEmails);
      onUpdate && onUpdate({ ...guide, shared_emails: updatedEmails });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGenerateLink = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(endpoints.guides.shareToken(guide.id), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to generate share link');
      const data = await response.json();
      const link = `${window.location.origin}/share?token=${data.token}`;
      setShareLink(link);
      onUpdate && onUpdate({ ...guide, share_token: data.token });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal-content" onClick={e => e.stopPropagation()}>
        <div className="share-modal-header">
          <h2>Share Guide: {guide.name}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {error && <p className="modal-error">{error}</p>}

        <div className="share-section">
          <h3>Privacy</h3>
          <label className="switch-container">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={handleTogglePublic}
            />
            <span className="slider"></span>
            <span className="switch-label">
              {isPublic ? 'Public (Visible in Explore)' : 'Private (Invite only)'}
            </span>
          </label>
        </div>

        <div className="share-section">
          <h3>Shared with</h3>
          <form onSubmit={handleAddEmail} className="email-form">
            <input
              type="email"
              placeholder="Enter Gmail address..."
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              required
            />
            <button type="submit">Add Member</button>
          </form>
          <ul className="email-list">
            {emails.length === 0 && <li className="empty-list">No members added yet.</li>}
            {emails.map(email => (
              <li key={email}>
                <span className="email-text">{email}</span>
                <button
                  className="revoke-btn"
                  onClick={() => handleRemoveEmail(email)}
                >
                  Revoke Access
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="share-section">
          <h3>Share Link</h3>
          {!shareLink ? (
            <button
              className="cta-button primary"
              onClick={handleGenerateLink}
              disabled={loading}
            >
              {loading ? 'Generating...' : 'Generate Shareable Link'}
            </button>
          ) : (
            <div className="link-container">
              <input type="text" value={shareLink} readOnly />
              <button className="copy-btn" onClick={copyToClipboard}>
                {copied ? 'Copied!' : (
                  <svg className="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
