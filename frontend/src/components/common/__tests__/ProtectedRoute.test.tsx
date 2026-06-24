import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '@testing-library/jest-dom';
import ProtectedRoute from '../ProtectedRoute';
import { AuthProvider } from '../../../hooks/useAuth';

// Helper to render with a specific auth state
const renderWithAuth = (
  component: React.ReactElement,
  initialEntries: string[] = ['/overview']
) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <Routes>
          <Route path="/overview" element={component} />
          <Route path="/login" element={<div data-testid="login-screen">Login Screen</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
};

describe('ProtectedRoute Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('should render protected content when authenticated', async () => {
    localStorage.setItem('authToken', 'mock-token');
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'test@example.com' }));
    localStorage.setItem('sessionTimestamp', Date.now().toString());

    // Mock fetch for verifyToken — authService uses axios internally
    // We mock the verifyToken call by setting up a valid session
    const { waitFor } = require('@testing-library/react');

    renderWithAuth(
      <ProtectedRoute>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>
    );

    // Since we have a token and valid session, it should render the protected content
    // after the auth check completes
    await waitFor(() => {
      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });

  test('should redirect to /login when not authenticated', async () => {
    const { waitFor } = require('@testing-library/react');

    renderWithAuth(
      <ProtectedRoute>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>
    );

    // Should redirect to login since no auth token
    await waitFor(() => {
      expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    });
  });

  test('should redirect to /login when session is expired', async () => {
    localStorage.setItem('authToken', 'mock-token');
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'test@example.com' }));
    // Set session timestamp to 4 days ago (expired — session is 3 days)
    localStorage.setItem('sessionTimestamp', (Date.now() - 4 * 24 * 60 * 60 * 1000).toString());

    const { waitFor } = require('@testing-library/react');

    renderWithAuth(
      <ProtectedRoute>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>
    );

    await waitFor(() => {
      expect(screen.getByTestId('login-screen')).toBeInTheDocument();
    });
  });
});