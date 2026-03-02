import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import GuideCard from './GuideCard';

const mockGuide = {
  id: '1',
  name: 'Test Guide',
  shortcut: '/test',
  description: 'A test guide description',
  is_public: true,
  steps: [{ instruction: 'Step 1' }]
};

describe('GuideCard', () => {
  test('renders public badge when is_public is true', () => {
    render(<GuideCard guide={mockGuide} isOwner={true} />);
    expect(screen.getByText('Public')).toBeInTheDocument();
  });

  test('renders shared badge when isOwner is false', () => {
    render(<GuideCard guide={mockGuide} isOwner={false} />);
    expect(screen.getByText('Shared')).toBeInTheDocument();
  });

  test('renders edit button when onEdit is provided', () => {
    const onEdit = jest.fn();
    render(<GuideCard guide={mockGuide} onEdit={onEdit} />);
    const editBtn = screen.getByText('Edit');
    expect(editBtn).toBeInTheDocument();
    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledWith(mockGuide);
  });

  test('hides share and delete buttons for non-owners', () => {
    render(<GuideCard guide={mockGuide} isOwner={false} showDelete={true} onShare={() => {}} />);
    expect(screen.queryByText('Share')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Delete/i)).not.toBeInTheDocument();
  });

  test('shows share and delete buttons for owners', () => {
    render(<GuideCard guide={mockGuide} isOwner={true} showDelete={true} onShare={() => {}} />);
    expect(screen.getByText('Share')).toBeInTheDocument();
    expect(screen.getByLabelText(/Delete/i)).toBeInTheDocument();
  });
});
