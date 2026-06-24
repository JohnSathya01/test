import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import ResetPassword from '../ResetPassword';
import authService from '../../../services/authService';

// Mock the auth service
jest.mock('../../../services/authService');
const mockAuthService = authService as jest.Mocked<typeof authService>;

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams('token=valid-reset-token'), null],
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('ResetPassword Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthService.verifyResetToken.mockResolvedValue({
      valid: true,
      email: 'user@example.com',
    });
  });

  test('renders reset password form with all required elements', async () => {
    renderWithRouter(<ResetPassword />);

    await waitFor(() => {
      expect(screen.getByText('Set a new password')).toBeInTheDocument();
    });

    expect(screen.getByText('Enter and confirm new password for user@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('New Password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Confirm new password')).toBeInTheDocument();
    expect(screen.getByText('Continue')).toBeInTheDocument();
    expect(screen.getByText('Back to sign in')).toBeInTheDocument();
  });

  test('disables Continue button when fields are empty', async () => {
    renderWithRouter(<ResetPassword />);

    await waitFor(() => {
      expect(screen.getByText('Continue')).toBeInTheDocument();
    });

    const submitButton = screen.getByText('Continue');
    expect(submitButton).toBeDisabled();
  });

  test('disables Continue button when password does not meet policy', async () => {
    renderWithRouter(<ResetPassword />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('New Password')).toBeInTheDocument();
    });

    const newPasswordInput = screen.getByPlaceholderText('New Password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm new password');
    const submitButton = screen.getByText('Continue');

    fireEvent.change(newPasswordInput, { target: { value: 'weak' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'weak' } });

    expect(submitButton).toBeDisabled();
  });

  test('enables Continue button when valid passwords match', async () => {
    renderWithRouter(<ResetPassword />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('New Password')).toBeInTheDocument();
    });

    const newPasswordInput = screen.getByPlaceholderText('New Password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm new password');
    const submitButton = screen.getByText('Continue');

    fireEvent.change(newPasswordInput, { target: { value: 'ValidPass123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'ValidPass123!' } });

    expect(submitButton).not.toBeDisabled();
  });

  test('shows password policy errors', async () => {
    renderWithRouter(<ResetPassword />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('New Password')).toBeInTheDocument();
    });

    const newPasswordInput = screen.getByPlaceholderText('New Password');

    fireEvent.change(newPasswordInput, { target: { value: 'weak' } });

    expect(screen.getByText('Password must be at least 8 characters long')).toBeInTheDocument();
  });

  test('shows password mismatch error inline', async () => {
    renderWithRouter(<ResetPassword />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('New Password')).toBeInTheDocument();
    });

    const newPasswordInput = screen.getByPlaceholderText('New Password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm new password');

    fireEvent.change(newPasswordInput, { target: { value: 'ValidPass123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'DifferentPass123!' } });

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
  });

  test('handles successful password reset with redirect to login', async () => {
    jest.useFakeTimers();

    mockAuthService.resetPassword.mockResolvedValue({
      success: true,
      message: 'Your password has been successfully reset.',
    });

    renderWithRouter(<ResetPassword />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('New Password')).toBeInTheDocument();
    });

    const newPasswordInput = screen.getByPlaceholderText('New Password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm new password');
    const submitButton = screen.getByText('Continue');

    fireEvent.change(newPasswordInput, { target: { value: 'ValidPass123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'ValidPass123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Your password has been successfully reset.')).toBeInTheDocument();
    });

    // Fast-forward time for redirect
    jest.advanceTimersByTime(3000);

    expect(mockNavigate).toHaveBeenCalledWith('/login');

    jest.useRealTimers();
  });

  test('handles expired token error', async () => {
    mockAuthService.verifyResetToken.mockResolvedValue({
      valid: false,
    });

    renderWithRouter(<ResetPassword />);

    await waitFor(() => {
      expect(screen.getByText('This recovery link has expired.')).toBeInTheDocument();
    });
  });

  test('handles password mismatch error from API (EX_7.4)', async () => {
    mockAuthService.resetPassword.mockRejectedValue({
      message: 'Passwords do not match. Please re-enter.',
      code: 'EX_7.4',
    });

    renderWithRouter(<ResetPassword />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('New Password')).toBeInTheDocument();
    });

    const newPasswordInput = screen.getByPlaceholderText('New Password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm new password');
    const submitButton = screen.getByText('Continue');

    fireEvent.change(newPasswordInput, { target: { value: 'ValidPass123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'ValidPass123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match. Please re-enter.')).toBeInTheDocument();
    });
  });

  test('handles expired link error from API', async () => {
    mockAuthService.resetPassword.mockRejectedValue({
      message: 'This recovery link has expired.',
    });

    renderWithRouter(<ResetPassword />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('New Password')).toBeInTheDocument();
    });

    const newPasswordInput = screen.getByPlaceholderText('New Password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm new password');
    const submitButton = screen.getByText('Continue');

    fireEvent.change(newPasswordInput, { target: { value: 'ValidPass123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'ValidPass123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('This recovery link has expired.')).toBeInTheDocument();
    });
  });

  test('shows loading state during reset', async () => {
    mockAuthService.resetPassword.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    renderWithRouter(<ResetPassword />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('New Password')).toBeInTheDocument();
    });

    const newPasswordInput = screen.getByPlaceholderText('New Password');
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm new password');
    const submitButton = screen.getByText('Continue');

    fireEvent.change(newPasswordInput, { target: { value: 'ValidPass123!' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'ValidPass123!' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Updating...')).toBeInTheDocument();
    });
  });

  test('back to sign in link works', async () => {
    renderWithRouter(<ResetPassword />);

    await waitFor(() => {
      expect(screen.getByText('Back to sign in')).toBeInTheDocument();
    });

    const backLink = screen.getByText('Back to sign in');
    expect(backLink.closest('a')).toHaveAttribute('href', '/login');
  });
});