import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginScreen from './components/Login/LoginScreen';
import ForgotPassword from './components/Login/ForgotPassword';
import ResetPassword from './components/Login/ResetPassword';
import ForgotPasswordConfirmation from './components/Login/ForgotPasswordConfirmation';
import Overview from './components/Overview/Overview';
import ProtectedRoute from './components/common/ProtectedRoute';
import { AuthProvider } from './hooks/useAuth';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/forgot-password-confirmation" element={<ForgotPasswordConfirmation />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/overview"
              element={
                <ProtectedRoute>
                  <Overview />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;