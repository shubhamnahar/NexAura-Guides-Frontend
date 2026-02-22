// src/components/GuideCard.js
import React, { useState } from 'react';
import './GuideCard.css';

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

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (!onDelete) return;

    if (
      window.confirm(
        `Are you sure you want to delete the guide "${guide.name}"?`
      )
    ) {
      onDelete(guide.id);
    }
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
      <p className="guide-card-shortcut">{guide.shortcut}</p>
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
              onClick={handleDeleteClick}
            >
              Delete
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
    </div>
  );
};

export default GuideCard;
