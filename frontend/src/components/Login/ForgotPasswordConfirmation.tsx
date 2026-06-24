import React from 'react';
import { Link } from 'react-router-dom';

const ForgotPasswordConfirmation: React.FC = () => {
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="logo-container">
          <div className="logo-text">SA</div>
        </div>

        <div className="confirmation-icon">✓</div>

        <h1 className="auth-title">Check your email</h1>
        <p className="auth-subtitle confirmation-message">
          A password reset link has been sent to your email. The link expires in 10 minutes.
        </p>

        <Link to="/login" className="back-link">
          <div className="icon-arrow-left"></div>
          Back to sign in
        </Link>
      </div>
    </div>
  );
};

export default ForgotPasswordConfirmation;