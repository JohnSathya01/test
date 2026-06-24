import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('sessionTimestamp');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    email: string;
  };
  message: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface VerifyResetTokenResponse {
  valid: boolean;
  email?: string;
}

export interface ApiError {
  message: string;
  code?: string;
}

export const authService = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    try {
      const response = await api.post('/auth/login', credentials);
      return response.data;
    } catch (error: any) {
      throw {
        message: error.response?.data?.message || 'Login failed',
        code: error.response?.data?.code
      } as ApiError;
    }
  },

  forgotPassword: async (data: ForgotPasswordRequest): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.post('/auth/forgot-password', data);
      return response.data;
    } catch (error: any) {
      throw {
        message: error.response?.data?.message || 'Failed to send reset email',
        code: error.response?.data?.code
      } as ApiError;
    }
  },

  resetPassword: async (data: ResetPasswordRequest): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.post('/auth/reset-password', data);
      return response.data;
    } catch (error: any) {
      throw {
        message: error.response?.data?.message || 'Failed to reset password',
        code: error.response?.data?.code
      } as ApiError;
    }
  },

  verifyToken: async (): Promise<{ valid: boolean; user?: any }> => {
    try {
      const response = await api.get('/auth/verify');
      return response.data;
    } catch (error) {
      return { valid: false };
    }
  },

  verifyResetToken: async (token: string): Promise<VerifyResetTokenResponse> => {
    try {
      const response = await api.get(`/auth/verify-reset-token?token=${encodeURIComponent(token)}`);
      return response.data;
    } catch (error) {
      return { valid: false };
    }
  }
};

export default authService;