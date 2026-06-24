import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import ForgotPassword from '../ForgotPassword';
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

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('ForgotPassword Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders forgot password form with all required elements', async () => {
    renderWithRouter(<ForgotPassword />);
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Reset password')).toBeInTheDocument();
    expect(screen.getByText('Enter the email associated with your account')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
    expect(screen.getByText('Continue')).toBeInTheDocument();
    expect(screen.getByText('Back to sign in')).toBeInTheDocument();
  });

  test('validates email format and enables/disables submit button', async () => {
    renderWithRouter(<ForgotPassword />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText('Enter your email');
    const submitButton = screen.getByText('Continue');

    // Initially disabled
    expect(submitButton).toBeDisabled();

    // Invalid email
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    expect(submitButton).toBeDisabled();

    // Valid email
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    expect(submitButton).not.toBeDisabled();
  });

  test('handles successful password reset request and shows confirmation screen', async () => {
    mockAuthService.forgotPassword.mockResolvedValue({
      success: true,
      message: 'Password reset link sent to your email'
    });

    renderWithRouter(<ForgotPassword />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText('Enter your email');
    const submitButton = screen.getByText('Continue');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    // Wait for confirmation screen to appear
    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });

    expect(mockAuthService.forgotPassword).toHaveBeenCalledWith({
      email: 'test@example.com'
    });

    // Form should be hidden after successful submission
    expect(screen.queryByText('Continue')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Enter your email')).not.toBeInTheDocument();

    // Confirmation message should be displayed
    expect(screen.getByText('A password reset link has been sent to your email. The link expires in 10 minutes.')).toBeInTheDocument();
  });

  test('handles forgot password error', async () => {
    mockAuthService.forgotPassword.mockRejectedValue({
      message: 'Email not found'
    });

    renderWithRouter(<ForgotPassword />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText('Enter your email');
    const submitButton = screen.getByText('Continue');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Email not found')).toBeInTheDocument();
    });
  });

  test('shows loading state during password reset request', async () => {
    mockAuthService.forgotPassword.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    renderWithRouter(<ForgotPassword />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText('Enter your email');
    const submitButton = screen.getByText('Continue');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    expect(screen.getByText('Sending...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });

  test('back to sign in link navigates to /login from confirmation screen', async () => {
    mockAuthService.forgotPassword.mockResolvedValue({
      success: true,
      message: 'Password reset link sent to your email'
    });

    renderWithRouter(<ForgotPassword />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    const emailInput = screen.getByPlaceholderText('Enter your email');
    const submitButton = screen.getByText('Continue');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.click(submitButton);

    // Wait for confirmation screen
    await waitFor(() => {
      expect(screen.getByText('Check your email')).toBeInTheDocument();
    });

    // Back to sign in link should be present on confirmation screen
    const backLink = screen.getByText('Back to sign in');
    expect(backLink.closest('a')).toHaveAttribute('href', '/login');
  });

  test('back to sign in link works from initial form', async () => {
    renderWithRouter(<ForgotPassword />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    const backLink = screen.getByText('Back to sign in');
    expect(backLink.closest('a')).toHaveAttribute('href', '/login');
  });
});