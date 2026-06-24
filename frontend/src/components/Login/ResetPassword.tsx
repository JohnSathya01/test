import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { validatePassword, validatePasswordMatch } from '../../utils/validation';
import authService from '../../services/authService';
import LoadingSpinner from '../common/LoadingSpinner';

const ResetPassword: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [screenLoading, setScreenLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    const init = async () => {
      // Simulate screen loading
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setScreenLoading(false);

      // Verify reset token to get email
      if (token) {
        try {
          const result = await authService.verifyResetToken(token);
          if (result.valid && result.email) {
            setEmail(result.email);
            setTokenValid(true);
          } else {
            setTokenValid(false);
            setError('This recovery link has expired.');
          }
        } catch {
          setTokenValid(false);
          setError('This recovery link has expired.');
        }
      } else {
        setTokenValid(false);
        setError('Invalid or missing reset token');
      }
    };

    init();
  }, [token]);

  const passwordValidation = validatePassword(newPassword);
  const passwordsMatch = validatePasswordMatch(newPassword, confirmPassword);
  const isFormValid = 
    newPassword.trim() !== '' && 
    confirmPassword.trim() !== '' && 
    passwordValidation.isValid && 
    passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid || !token) return;

    if (!passwordsMatch) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    if (!passwordValidation.isValid) {
      setError('Password does not meet requirements.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await authService.resetPassword({
        token,
        newPassword,
        confirmPassword
      });
      
      setSuccess('Your password has been successfully reset.');
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      if (err.message.includes('expired')) {
        setError('This recovery link has expired.');
      } else if (err.code === 'EX_7.4') {
        setError('Passwords do not match. Please re-enter.');
      } else {
        setError(err.message || 'Failed to reset password. Please try again.');
      }
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

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="logo-container">
          <div className="logo-text">SA</div>
        </div>
        
        <h1 className="auth-title">Set a new password</h1>
        <p className="auth-subtitle">Enter and confirm new password for {email}</p>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {!success && tokenValid && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <div className="input-container">
                <div className="input-icon icon-lock"></div>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  className={`form-input ${!passwordValidation.isValid && newPassword ? 'error' : ''}`}
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label="toggle new password"
                >
                  <div className={showNewPassword ? 'icon-eye-off' : 'icon-eye'}></div>
                </button>
              </div>
              {newPassword && !passwordValidation.isValid && (
                <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>
                  {passwordValidation.errors.map((error, index) => (
                    <div key={index}>• {error}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <div className="input-container">
                <div className="input-icon icon-lock"></div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className={`form-input ${!passwordsMatch && confirmPassword ? 'error' : ''}`}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label="toggle confirm password"
                >
                  <div className={showConfirmPassword ? 'icon-eye-off' : 'icon-eye'}></div>
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>
                  Passwords do not match
                </div>
              )}
            </div>

            <button
              type="submit"
              className="auth-button"
              disabled={!isFormValid || isLoading || !token}
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="small" />
                  Updating...
                </>
              ) : (
                'Continue'
              )}
            </button>
          </form>
        )}

        <Link to="/login" className="back-link">
          <div className="icon-arrow-left"></div>
          Back to sign in
        </Link>
      </div>
    </div>
  );
};

export default ResetPassword;