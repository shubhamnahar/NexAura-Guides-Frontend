import React, { useState } from 'react';
import { endpoints } from '../../services/api';
import '../../styles/components/EditModal.css';

const EditModal = ({ guide, token, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: guide.name || '',
    description: guide.description || '',
    shortcut: guide.shortcut || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(endpoints.guides.update(guide.id), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 400 && data.detail && data.detail.toLowerCase().includes('shortcut')) {
          throw new Error('This shortcut is already in use. Please choose a different one.');
        }
        throw new Error(data.detail || 'Failed to update guide');
      }

      const updatedGuide = await response.json();
      onUpdate && onUpdate(updatedGuide);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="edit-modal-overlay" onClick={onClose}>
      <div className="edit-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="edit-modal-header">
          <h2>Edit Guide Details</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        {error && <div className="modal-error">{error}</div>}

        <form onSubmit={handleSubmit} className="edit-form">
          <div className="form-group">
            <label htmlFor="name">Guide Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="shortcut">Shortcut (must be unique)</label>
            <input
              type="text"
              id="shortcut"
              name="shortcut"
              value={formData.shortcut}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              rows="4"
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="cta-button secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="cta-button primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditModal;
