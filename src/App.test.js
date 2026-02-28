import { render, screen } from '@testing-library/react';
import App from './App';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';

test('renders landing page headline', () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
  const headlineElement = screen.getByText(/Turn complex workflows into/i);
  expect(headlineElement).toBeInTheDocument();
});
