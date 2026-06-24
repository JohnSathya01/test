import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { validateEmail } from '../../utils/validation';
import authService from '../../services/authService';
import LoadingSpinner from '../common/LoadingSpinner';
import ForgotPasswordConfirmation from './ForgotPasswordConfirmation';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [screenLoading, setScreenLoading] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    // Simulate screen loading
    const timer = setTimeout(() => {
      setScreenLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const isFormValid = email.trim() !== '' && validateEmail(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid) return;

    setIsLoading(true);
    setError('');

    try {
      await authService.forgotPassword({ email });
      setIsSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (screenLoading) {
    return (
      <div className="screen-loader">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // Show confirmation screen after successful submission
  if (isSubmitted) {
    return <ForgotPasswordConfirmation />;
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="logo-container">
          <div className="logo-text">SA</div>
        </div>
        
        <h1 className="auth-title">Reset password</h1>
        <p className="auth-subtitle">Enter the email associated with your account</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <div className="input-container">
              <div className="input-icon icon-mail"></div>
              <input
                type="email"
                className={`form-input ${error && !validateEmail(email) ? 'error' : ''}`}
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="auth-button"
            disabled={!isFormValid || isLoading}
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="small" />
                Sending...
              </>
            ) : (
              'Continue'
            )}
          </button>
        </form>

        <Link to="/login" className="back-link">
          <div className="icon-arrow-left"></div>
          Back to sign in
        </Link>
      </div>
    </div>
  );
};

export default ForgotPassword;