// src/components/GuideCard.js
import React, { useState } from 'react';
import '../../styles/components/GuideCard.css';

/**
 * Props:
 * - guide: Guide object
 * - showDelete: boolean (show delete button)
 * - onDelete: function(guideId)
 * - showDownload: boolean (show download button)
 * - onDownload: function(guide)
 */
const GuideCard = ({
  guide,
  showDelete = false,
  onDelete,
  showDownload = false,
  onDownload,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const copyShortcut = async (e) => {
    e.stopPropagation();
    if (!guide?.shortcut) return;
    try {
      await navigator.clipboard.writeText(guide.shortcut);
      setCopied(true);
      setToastVisible(true);
      setTimeout(() => {
        setCopied(false);
        setToastVisible(false);
      }, 1400);
    } catch (err) {
      console.warn('Clipboard copy failed', err);
    }
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (!onDelete) return;
    setConfirmOpen(true);
  };

  const handleDownloadClick = (e) => {
    e.stopPropagation();
    if (!onDownload) return;
    onDownload(guide);
  };

  const hasActions = showDelete || showDownload;

  return (
    <div
      className={`guide-card ${isExpanded ? 'expanded' : ''}`}
      // Click-to-expand only when the card is "read-only" (public explore view)
      onClick={() => {
        if (!hasActions) {
          setIsExpanded((prev) => !prev);
        }
      }}
      style={{ cursor: hasActions ? 'default' : 'pointer' }}
    >
      <h3 className="guide-card-title">{guide.name}</h3>
      <p
        className="guide-card-shortcut"
        onClick={copyShortcut}
        title="Click to copy shortcut"
      >
        {guide.shortcut}
        {copied && <span className="copied-dot" aria-label="Copied">•</span>}
      </p>
      <p className="guide-card-description">{guide.description}</p>
      <span className="guide-card-steps">
        {guide.steps.length}{' '}
        {guide.steps.length === 1 ? 'Step' : 'Steps'}
      </span>

      {hasActions && (
        <div className="guide-card-actions">
          {/* Show Steps toggle (for "My Guides" page) */}
          <button
            className="guide-card-expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((prev) => !prev);
            }}
          >
            {isExpanded ? 'Hide Steps' : 'Show Steps'}
          </button>

          {showDownload && (
            <button
              className="guide-card-download-btn"
              onClick={handleDownloadClick}
            >
              Download PDF
            </button>
          )}

          {showDelete && (
            <button
              className="guide-card-delete-btn"
              aria-label={`Delete ${guide.name}`}
              onClick={handleDeleteClick}
            >
              <svg
                className="delete-icon"
                viewBox="0 0 24 24"
                role="img"
                aria-hidden="true"
              >
                <path
                  d="M9 3h6a1 1 0 0 1 1 1v2h4v2h-1v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8H3V6h4V4a1 1 0 0 1 1-1Zm6 2H9v1h6V5ZM7 8v11h10V8H7Zm3 2h2v7h-2v-7Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          )}
        </div>
      )}

      {isExpanded && (
        <div className="guide-card-steps-list">
          <h4>Guide Steps:</h4>
          <ol>
            {guide.steps.map((step, index) => (
              <li key={index}>{step.instruction}</li>
            ))}
          </ol>
        </div>
      )}

      {confirmOpen && (
        <div className="guide-card-confirm" role="dialog" aria-modal="true">
          <div className="confirm-body">
            <p>
              Delete “<strong>{guide.name}</strong>”?
            </p>
            <div className="confirm-actions">
              <button
                className="confirm-cancel"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmOpen(false);
                }}
              >
                Keep it
              </button>
              <button
                className="confirm-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmOpen(false);
                  onDelete && onDelete(guide.id);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {toastVisible && (
        <div className="copy-toast" role="status" aria-live="polite">
          Guide shortcut copied
        </div>
      )}
    </div>
  );
};

export default GuideCard;
