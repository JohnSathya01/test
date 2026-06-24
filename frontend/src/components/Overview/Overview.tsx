import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const Overview: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="overview-container">
      <div className="overview-card">
        <div className="logo-container">
          <div className="logo-text">SA</div>
        </div>
        <h1 className="auth-title">Welcome to SoundryAI</h1>
        <p className="auth-subtitle">
          You are logged in{user?.email ? ` as ${user.email}` : ''}.
        </p>
        <button className="auth-button" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </div>
  );
};

export default Overview;