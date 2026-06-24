import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@testing-library/jest-dom';
import Overview from '../Overview';
import { AuthProvider } from '../../../hooks/useAuth';

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <MemoryRouter initialEntries={['/overview']}>
      <AuthProvider>
        <Routes>
          <Route path="/overview" element={component} />
          <Route path="/login" element={<div data-testid="login-screen">Login Screen</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('Overview Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('should render welcome message and logout button when authenticated', async () => {
    localStorage.setItem('authToken', 'mock-token');
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'test@example.com' }));
    localStorage.setItem('sessionTimestamp', Date.now().toString());

    const { waitFor } = require('@testing-library/react');

    renderWithProviders(<Overview />);

    await waitFor(() => {
      expect(screen.getByText('Welcome to SoundryAI')).toBeInTheDocument();
    });

    expect(screen.getByText('You are logged in as test@example.com.')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  test('should display user email in subtitle', async () => {
    localStorage.setItem('authToken', 'mock-token');
    localStorage.setItem('user', JSON.stringify({ id: '2', email: 'user@test.com' }));
    localStorage.setItem('sessionTimestamp', Date.now().toString());

    const { waitFor } = require('@testing-library/react');

    renderWithProviders(<Overview />);

    await waitFor(() => {
      expect(screen.getByText('You are logged in as user@test.com.')).toBeInTheDocument();
    });
  });

  test('should navigate to /login on logout', async () => {
    localStorage.setItem('authToken', 'mock-token');
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'test@example.com' }));
    localStorage.setItem('sessionTimestamp', Date.now().toString());

    const { waitFor } = require('@testing-library/react');

    renderWithProviders(<Overview />);

    await waitFor(() => {
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Logout'));

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  test('should clear localStorage on logout', async () => {
    localStorage.setItem('authToken', 'mock-token');
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'test@example.com' }));
    localStorage.setItem('sessionTimestamp', Date.now().toString());

    const { waitFor } = require('@testing-library/react');

    renderWithProviders(<Overview />);

    await waitFor(() => {
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Logout'));

    expect(localStorage.getItem('authToken')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('sessionTimestamp')).toBeNull();
  });

  test('should render logo with SA text', async () => {
    localStorage.setItem('authToken', 'mock-token');
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'test@example.com' }));
    localStorage.setItem('sessionTimestamp', Date.now().toString());

    const { waitFor } = require('@testing-library/react');

    renderWithProviders(<Overview />);

    await waitFor(() => {
      expect(screen.getByText('SA')).toBeInTheDocument();
    });
  });
});