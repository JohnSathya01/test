import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import ForgotPasswordConfirmation from '../ForgotPasswordConfirmation';

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('ForgotPasswordConfirmation Component', () => {
  test('renders confirmation screen with all required elements', () => {
    renderWithRouter(<ForgotPasswordConfirmation />);

    expect(screen.getByText('Check your email')).toBeInTheDocument();
    expect(
      screen.getByText('A password reset link has been sent to your email. The link expires in 10 minutes.')
    ).toBeInTheDocument();
    expect(screen.getByText('Back to sign in')).toBeInTheDocument();
  });

  test('back to sign in link navigates to /login', () => {
    renderWithRouter(<ForgotPasswordConfirmation />);

    const backLink = screen.getByText('Back to sign in');
    expect(backLink.closest('a')).toHaveAttribute('href', '/login');
  });

  test('renders logo', () => {
    const { container } = renderWithRouter(<ForgotPasswordConfirmation />);

    const logoContainer = container.querySelector('.logo-container');
    expect(logoContainer).toBeInTheDocument();
    expect(screen.getByText('SA')).toBeInTheDocument();
  });

  test('renders confirmation icon', () => {
    const { container } = renderWithRouter(<ForgotPasswordConfirmation />);

    const confirmationIcon = container.querySelector('.confirmation-icon');
    expect(confirmationIcon).toBeInTheDocument();
  });
});