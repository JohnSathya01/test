import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import LoginScreen from '../LoginScreen';
import { AuthProvider } from '../../../hooks/useAuth';
import authService from '../../../services/authService';

// Mock the auth service
jest.mock('../../../services/authService');
const mockAuthService = authService as jest.Mocked<typeof authService>;

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('LoginScreen Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('renders login form with all required elements', async () => {
    renderWithProviders(<LoginScreen />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByText('Enter your account details below to continue')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.getByText('Forgot password?')).toBeInTheDocument();
  });

  test('validates email format and enables/disables submit button', async () => {
    renderWithProviders(<LoginScreen />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByText('Sign In');

    // Initially disabled
    expect(submitButton).toBeDisabled();

    // Invalid email
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    expect(submitButton).toBeDisabled();

    // Valid email and password
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    expect(submitButton).not.toBeDisabled();
  });

  test('toggles password visibility', async () => {
    renderWithProviders(<LoginScreen />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    const passwordInput = screen.getByPlaceholderText('Password') as HTMLInputElement;
    const toggleButton = screen.getByRole('button', { name: /toggle password/i });

    expect(passwordInput.type).toBe('password');
    
    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe('text');
    
    fireEvent.click(toggleButton);
    expect(passwordInput.type).toBe('password');
  });

  test('handles successful login', async () => {
    const mockUser = { id: '1', email: 'test@example.com' };
    mockAuthService.login.mockResolvedValue({
      success: true,
      token: 'mock-token',
      user: mockUser,
      message: 'Login successful'
    });

    renderWithProviders(<LoginScreen />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByText('Sign In');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Login successful! Redirecting...')).toBeInTheDocument();
    });

    expect(mockAuthService.login).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    });
  });

  test('handles login error with specific error codes', async () => {
    const testCases = [
      { code: 'EX_7.1', expectedMessage: 'Please enter a valid email address or password' },
      { code: 'EX_7.2', expectedMessage: 'Too many unsuccessful login attempts. Your account has been locked. Please try again after 15 minutes.' },
      { code: 'EX_7.3', expectedMessage: 'Invalid credentials' },
      { code: 'EX_7.5', expectedMessage: 'This account has been blocked.' },
    ];

    for (const testCase of testCases) {
      mockAuthService.login.mockRejectedValue({
        message: 'Login failed',
        code: testCase.code
      });

      renderWithProviders(<LoginScreen />);
      
      await waitFor(() => {
        expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Password');
      const submitButton = screen.getByText('Sign In');

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(testCase.expectedMessage)).toBeInTheDocument();
      });

      // Clear for next test
      jest.clearAllMocks();
    }
  });

  test('handles generic login error', async () => {
    mockAuthService.login.mockRejectedValue({
      message: 'Network error'
    });

    renderWithProviders(<LoginScreen />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByText('Sign In');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  test('shows loading state during login', async () => {
    mockAuthService.login.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    renderWithProviders(<LoginScreen />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByText('Sign In');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    expect(screen.getByText('Signing in...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  test('redirects authenticated users to overview', async () => {
    // Mock authenticated state
    localStorage.setItem('authToken', 'mock-token');
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'test@example.com' }));
    localStorage.setItem('sessionTimestamp', Date.now().toString());
    
    mockAuthService.verifyToken.mockResolvedValue({
      valid: true,
      user: { id: '1', email: 'test@example.com' }
    });

    renderWithProviders(<LoginScreen />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/overview');
    });
  });

  test('fields remain editable after lockout error (EX_7.2)', async () => {
    mockAuthService.login.mockRejectedValue({
      message: 'Login failed',
      code: 'EX_7.2'
    });

    renderWithProviders(<LoginScreen />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText('Enter your email') as HTMLInputElement;
    const passwordInput = screen.getByPlaceholderText('Password') as HTMLInputElement;
    const submitButton = screen.getByText('Sign In');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Too many unsuccessful login attempts. Your account has been locked. Please try again after 15 minutes.')).toBeInTheDocument();
    });

    // Fields should remain editable
    expect(emailInput).not.toBeDisabled();
    expect(passwordInput).not.toBeDisabled();
  });

  test('success message has green background (success-message class)', async () => {
    const mockUser = { id: '1', email: 'test@example.com' };
    mockAuthService.login.mockResolvedValue({
      success: true,
      token: 'mock-token',
      user: mockUser,
      message: 'Login successful'
    });

    renderWithProviders(<LoginScreen />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Password');
    const submitButton = screen.getByText('Sign In');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      const successMessage = screen.getByText('Login successful! Redirecting...');
      expect(successMessage.closest('.success-message')).not.toBeNull();
    });
  });
});