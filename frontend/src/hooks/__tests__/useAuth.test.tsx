import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuthProvider, useAuth } from '../useAuth';
import authService from '../../services/authService';

// Mock the auth service
jest.mock('../../services/authService');
const mockAuthService = authService as jest.Mocked<typeof authService>;

// Test component to access the auth context
const TestConsumer: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  return (
    <div>
      <div data-testid="user">{user ? user.email : 'null'}</div>
      <div data-testid="isAuthenticated">{isAuthenticated.toString()}</div>
      <div data-testid="isLoading">{isLoading.toString()}</div>
    </div>
  );
};

const renderWithProvider = () => {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );
};

describe('useAuth Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('should start with isLoading=true and no user', async () => {
    mockAuthService.verifyToken.mockResolvedValue({ valid: false });

    const { getByTestId } = renderWithProvider();

    // Initially loading
    expect(getByTestId('isLoading').textContent).toBe('true');

    // After initialization completes
    await waitFor(() => {
      expect(getByTestId('isLoading').textContent).toBe('false');
    });

    expect(getByTestId('user').textContent).toBe('null');
    expect(getByTestId('isAuthenticated').textContent).toBe('false');
  });

  test('should set user when token is valid and session is not expired', async () => {
    localStorage.setItem('authToken', 'mock-token');
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'test@example.com' }));
    localStorage.setItem('sessionTimestamp', Date.now().toString());

    mockAuthService.verifyToken.mockResolvedValue({
      valid: true,
      user: { id: '1', email: 'test@example.com' },
    });

    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('isLoading').textContent).toBe('false');
    });

    expect(getByTestId('user').textContent).toBe('test@example.com');
    expect(getByTestId('isAuthenticated').textContent).toBe('true');
  });

  test('should clear session when token verification fails', async () => {
    localStorage.setItem('authToken', 'mock-token');
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'test@example.com' }));
    localStorage.setItem('sessionTimestamp', Date.now().toString());

    mockAuthService.verifyToken.mockResolvedValue({ valid: false });

    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('isLoading').textContent).toBe('false');
    });

    expect(getByTestId('user').textContent).toBe('null');
    expect(getByTestId('isAuthenticated').textContent).toBe('false');
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  test('should clear session when session is expired', async () => {
    localStorage.setItem('authToken', 'mock-token');
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'test@example.com' }));
    // Set session timestamp to 4 days ago (expired — session is 3 days)
    localStorage.setItem('sessionTimestamp', (Date.now() - 4 * 24 * 60 * 60 * 1000).toString());

    mockAuthService.verifyToken.mockResolvedValue({ valid: true });

    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('isLoading').textContent).toBe('false');
    });

    expect(getByTestId('user').textContent).toBe('null');
    expect(getByTestId('isAuthenticated').textContent).toBe('false');
    expect(localStorage.getItem('authToken')).toBeNull();
  });

  test('should clear session when verifyToken throws an error', async () => {
    localStorage.setItem('authToken', 'mock-token');
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'test@example.com' }));
    localStorage.setItem('sessionTimestamp', Date.now().toString());

    mockAuthService.verifyToken.mockRejectedValue(new Error('Network error'));

    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('isLoading').textContent).toBe('false');
    });

    expect(getByTestId('user').textContent).toBe('null');
    expect(getByTestId('isAuthenticated').textContent).toBe('false');
    expect(localStorage.getItem('authToken')).toBeNull();
  });

  test('should throw error when useAuth is used outside AuthProvider', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const ConsumerOutsideProvider: React.FC = () => {
      useAuth();
      return null;
    };

    expect(() => render(<ConsumerOutsideProvider />)).toThrow(
      'useAuth must be used within an AuthProvider'
    );

    consoleErrorSpy.mockRestore();
  });

  test('should set user from saved user when verifyToken returns valid but no user object', async () => {
    const savedUser = { id: '1', email: 'saved@example.com' };
    localStorage.setItem('authToken', 'mock-token');
    localStorage.setItem('user', JSON.stringify(savedUser));
    localStorage.setItem('sessionTimestamp', Date.now().toString());

    mockAuthService.verifyToken.mockResolvedValue({ valid: true });

    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('isLoading').textContent).toBe('false');
    });

    // Should fall back to the saved user
    expect(getByTestId('user').textContent).toBe('saved@example.com');
    expect(getByTestId('isAuthenticated').textContent).toBe('true');
  });
});