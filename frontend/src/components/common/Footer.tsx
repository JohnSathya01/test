import React from 'react';

const Footer: React.FC = () => {
  return (
    <div className="auth-footer">
      By signing in, you agree to our{' '}
      <a 
        href="/terms-of-service" 
        target="_blank" 
        rel="noopener noreferrer"
      >
        Terms & Service
      </a>
    </div>
  );
};

export default Footer;