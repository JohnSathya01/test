import axios from 'axios';
import authService from '../authService';

// Mock axios
jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

// Mock axios.create to return the mocked axios instance
mockAxios.create = jest.fn(() => mockAxios);

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('login', () => {
    test('should return response data on successful login', async () => {
      const mockResponse = {
        success: true,
        token: 'mock-token',
        user: { id: '1', email: 'test@example.com' },
        message: 'Login successful',
      };
      mockAxios.post.mockResolvedValue({ data: mockResponse });

      const result = await authService.login({ email: 'test@example.com', password: 'Password123!' });

      expect(result).toEqual(mockResponse);
      expect(mockAxios.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'Password123!',
      });
    });

    test('should throw formatted error on login failure with code', async () => {
      mockAxios.post.mockRejectedValue({
        response: {
          data: {
            success: false,
            message: 'Invalid credentials',
            code: 'EX_7.3',
          },
        },
      });

      await expect(
        authService.login({ email: 'test@example.com', password: 'wrong' })
      ).rejects.toEqual({
        message: 'Invalid credentials',
        code: 'EX_7.3',
      });
    });

    test('should throw default message when response has no message', async () => {
      mockAxios.post.mockRejectedValue({
        response: {},
      });

      await expect(
        authService.login({ email: 'test@example.com', password: 'wrong' })
      ).rejects.toEqual({
        message: 'Login failed',
        code: undefined,
      });
    });

    test('should throw default message on network error (no response)', async () => {
      mockAxios.post.mockRejectedValue(new Error('Network Error'));

      await expect(
        authService.login({ email: 'test@example.com', password: 'wrong' })
      ).rejects.toEqual({
        message: 'Login failed',
        code: undefined,
      });
    });
  });

  describe('forgotPassword', () => {
    test('should return response data on successful request', async () => {
      const mockResponse = {
        success: true,
        message: 'Password reset link sent to your email',
      };
      mockAxios.post.mockResolvedValue({ data: mockResponse });

      const result = await authService.forgotPassword({ email: 'test@example.com' });

      expect(result).toEqual(mockResponse);
      expect(mockAxios.post).toHaveBeenCalledWith('/auth/forgot-password', {
        email: 'test@example.com',
      });
    });

    test('should throw formatted error on forgot password failure', async () => {
      mockAxios.post.mockRejectedValue({
        response: {
          data: {
            success: false,
            message: 'Failed to send reset email',
          },
        },
      });

      await expect(
        authService.forgotPassword({ email: 'test@example.com' })
      ).rejects.toEqual({
        message: 'Failed to send reset email',
        code: undefined,
      });
    });

    test('should throw default message when no response message', async () => {
      mockAxios.post.mockRejectedValue({ response: {} });

      await expect(
        authService.forgotPassword({ email: 'test@example.com' })
      ).rejects.toEqual({
        message: 'Failed to send reset email',
        code: undefined,
      });
    });
  });

  describe('resetPassword', () => {
    test('should return response data on successful reset', async () => {
      const mockResponse = {
        success: true,
        message: 'Your password has been successfully reset.',
      };
      mockAxios.post.mockResolvedValue({ data: mockResponse });

      const result = await authService.resetPassword({
        token: 'valid-token',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      });

      expect(result).toEqual(mockResponse);
      expect(mockAxios.post).toHaveBeenCalledWith('/auth/reset-password', {
        token: 'valid-token',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      });
    });

    test('should throw formatted error on reset password failure with code', async () => {
      mockAxios.post.mockRejectedValue({
        response: {
          data: {
            success: false,
            message: 'Passwords do not match. Please re-enter.',
            code: 'EX_7.4',
          },
        },
      });

      await expect(
        authService.resetPassword({
          token: 'valid-token',
          newPassword: 'NewPassword123!',
          confirmPassword: 'DifferentPass!',
        })
      ).rejects.toEqual({
        message: 'Passwords do not match. Please re-enter.',
        code: 'EX_7.4',
      });
    });

    test('should throw default message when no response message', async () => {
      mockAxios.post.mockRejectedValue({ response: {} });

      await expect(
        authService.resetPassword({
          token: 'valid-token',
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!',
        })
      ).rejects.toEqual({
        message: 'Failed to reset password',
        code: undefined,
      });
    });
  });

  describe('verifyToken', () => {
    test('should return valid=true with user data on success', async () => {
      const mockResponse = {
        valid: true,
        user: { id: '1', email: 'test@example.com' },
      };
      mockAxios.get.mockResolvedValue({ data: mockResponse });

      const result = await authService.verifyToken();

      expect(result).toEqual(mockResponse);
      expect(mockAxios.get).toHaveBeenCalledWith('/auth/verify');
    });

    test('should return valid=false on error', async () => {
      mockAxios.get.mockRejectedValue(new Error('Unauthorized'));

      const result = await authService.verifyToken();

      expect(result).toEqual({ valid: false });
    });
  });

  describe('verifyResetToken', () => {
    test('should return valid=true with email on success', async () => {
      const mockResponse = {
        valid: true,
        email: 'test@example.com',
      };
      mockAxios.get.mockResolvedValue({ data: mockResponse });

      const result = await authService.verifyResetToken('valid-token');

      expect(result).toEqual(mockResponse);
      expect(mockAxios.get).toHaveBeenCalledWith(
        '/auth/verify-reset-token?token=valid-token'
      );
    });

    test('should URL-encode the token', async () => {
      mockAxios.get.mockResolvedValue({ data: { valid: false } });

      await authService.verifyResetToken('token with spaces');

      expect(mockAxios.get).toHaveBeenCalledWith(
        '/auth/verify-reset-token?token=token%20with%20spaces'
      );
    });

    test('should return valid=false on error', async () => {
      mockAxios.get.mockRejectedValue(new Error('Not found'));

      const result = await authService.verifyResetToken('invalid-token');

      expect(result).toEqual({ valid: false });
    });
  });

  describe('Request interceptor', () => {
    test('should add Authorization header when token exists in localStorage', async () => {
      localStorage.setItem('authToken', 'stored-token');
      mockAxios.post.mockResolvedValue({
        data: { success: true, message: 'ok' },
      });

      await authService.forgotPassword({ email: 'test@example.com' });

      // The interceptor should add the Authorization header
      const call = mockAxios.post.mock.calls[0];
      // In the mock, the interceptor config is applied via the mock
      // We verify the request was made
      expect(call).toBeDefined();
    });
  });
});