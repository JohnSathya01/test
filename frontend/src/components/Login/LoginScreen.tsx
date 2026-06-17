import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { validateEmail } from '../../utils/validation';
import { useAuth } from '../../hooks/useAuth';
import LoadingSpinner from '../common/LoadingSpinner';
import Footer from '../common/Footer';

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [screenLoading, setScreenLoading] = useState(true);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Simulate screen loading
    const timer = setTimeout(() => {
      setScreenLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/overview');
    }
  }, [isAuthenticated, navigate]);

  const isFormValid = email.trim() !== '' && password.trim() !== '' && validateEmail(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid) return;

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      await login(email, password);
      setSuccess('Login successful! Redirecting...');
      setTimeout(() => {
        navigate('/overview');
      }, 1500);
    } catch (err: any) {
      // Handle specific error codes
      switch (err.code) {
        case 'EX_7.1':
          setError('Please enter a valid email address or password');
          break;
        case 'EX_7.2':
          setError('Too many unsuccessful login attempts. Please try again later.');
          break;
        case 'EX_7.3':
          setError('Invalid credentials');
          break;
        case 'EX_7.5':
          setError('This account has been blocked.');
          break;
        default:
          setError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
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
        
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Enter your account details below to continue</p>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

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

          <div className="form-group">
            <div className="input-container">
              <div className="input-icon icon-lock"></div>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={togglePasswordVisibility}
              >
                <div className={showPassword ? 'icon-eye-off' : 'icon-eye'}></div>
              </button>
            </div>
            <div className="forgot-password">
              <Link to="/forgot-password">Forgot password?</Link>
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
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <Footer />
      </div>
    </div>
  );
};

export default LoginScreen;