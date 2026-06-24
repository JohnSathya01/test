import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import express from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import User, { IUser } from '../models/User';
import authRoutes from '../routes/authRoutes';
import { errorHandler } from '../middleware/errorHandler';

// Mock email service
jest.mock('../services/emailService', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
}));

import sendResetEmail from '../services/emailService';
const mockSendResetEmail = sendResetEmail as jest.MockedFunction<typeof sendResetEmail>;

// Test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use(errorHandler);

let mongoServer: MongoMemoryServer;

const TEST_JWT_SECRET = 'test-jwt-secret';

// Helper to create a user
const createTestUser = async (email: string, password: string): Promise<IUser> => {
  const user = new User({ email, password });
  await user.save();
  return user;
};

describe('Auth API', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.JWT_EXPIRES_IN = '3d';
    process.env.CLIENT_URL = 'http://localhost:3000';
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await User.deleteMany({});
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    test('should login successfully with valid credentials', async () => {
      await createTestUser('test@example.com', 'Password123!');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'Password123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.message).toBe('Login successful');
    });

    test('should return EX_7.3 for wrong password', async () => {
      await createTestUser('test@example.com', 'Password123!');

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'WrongPassword123!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('EX_7.3');
      expect(res.body.message).toBe('Incorrect password. Please try again.');
    });

    test('should return EX_7.3 for non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'Password123!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('EX_7.3');
      expect(res.body.message).toBe('Invalid credentials');
    });

    test('should lock account after 5 failed attempts (EX_7.2)', async () => {
      await createTestUser('test@example.com', 'Password123!');

      // Make 4 failed attempts
      for (let i = 0; i < 4; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'WrongPassword123!' });
      }

      // 5th attempt should trigger lockout
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'WrongPassword123!' });

      expect(res.status).toBe(423);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('EX_7.2');
      expect(res.body.message).toBe(
        'Too many unsuccessful login attempts. Your account has been locked. Please try again after 15 minutes.'
      );
    });

    test('should block login during lockout period', async () => {
      const user = await createTestUser('test@example.com', 'Password123!');
      user.failedLoginAttempts = 5;
      user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'Password123!' });

      expect(res.status).toBe(423);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('EX_7.2');
    });

    test('should allow login after lockout expiry', async () => {
      const user = await createTestUser('test@example.com', 'Password123!');
      user.failedLoginAttempts = 5;
      user.lockUntil = new Date(Date.now() - 1000); // expired
      await user.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'Password123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
    });

    test('should return 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'invalid-email', password: 'Password123!' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('EX_7.1');
    });

    test('should return 400 for empty password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: '' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('EX_7.1');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    test('should send reset email for registered user', async () => {
      await createTestUser('test@example.com', 'Password123!');

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Password reset link sent to your email');
      expect(mockSendResetEmail).toHaveBeenCalledTimes(1);
    });

    test('should return success for non-existent email (prevent enumeration)', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Password reset link sent to your email');
      expect(mockSendResetEmail).not.toHaveBeenCalled();
    });

    test('should return 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'invalid-email' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    test('should reset password successfully', async () => {
      const user = await createTestUser('test@example.com', 'OldPassword123!');

      // Set reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Your password has been successfully reset.');

      // Verify token is cleared
      const updatedUser = await User.findById(user._id).select('+resetPasswordToken');
      expect(updatedUser?.resetPasswordToken).toBeNull();
    });

    test('should return error for expired token', async () => {
      const user = await createTestUser('test@example.com', 'OldPassword123!');

      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = new Date(Date.now() - 1000); // expired
      await user.save();

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('This recovery link has expired.');
    });

    test('should return EX_7.4 for password mismatch', async () => {
      const user = await createTestUser('test@example.com', 'OldPassword123!');

      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'NewPassword123!',
          confirmPassword: 'DifferentPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('EX_7.4');
      expect(res.body.message).toBe('Passwords do not match. Please re-enter.');
    });

    test('should return error for password not meeting policy', async () => {
      const user = await createTestUser('test@example.com', 'OldPassword123!');

      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'weak',
          confirmPassword: 'weak',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Password does not meet requirements.');
    });

    test('should return error for invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('This recovery link has expired.');
    });
  });

  describe('GET /api/auth/verify', () => {
    test('should return valid for valid token', async () => {
      const user = await createTestUser('test@example.com', 'Password123!');
      const token = jwt.sign({ id: user._id.toString(), email: user.email }, TEST_JWT_SECRET, {
        expiresIn: '3d',
      });

      const res = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.user.email).toBe('test@example.com');
    });

    test('should return 401 for invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('should return 401 for missing token', async () => {
      const res = await request(app).get('/api/auth/verify');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/verify-reset-token', () => {
    test('should return valid=true and email for valid token', async () => {
      const user = await createTestUser('test@example.com', 'Password123!');

      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      const res = await request(app)
        .get(`/api/auth/verify-reset-token?token=${resetToken}`);

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
      expect(res.body.email).toBe('test@example.com');
    });

    test('should return valid=false for expired token', async () => {
      const user = await createTestUser('test@example.com', 'Password123!');

      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = new Date(Date.now() - 1000); // expired
      await user.save();

      const res = await request(app)
        .get(`/api/auth/verify-reset-token?token=${resetToken}`);

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });

    test('should return valid=false for invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/verify-reset-token?token=invalid-token');

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });

    test('should return valid=false for missing token', async () => {
      const res = await request(app)
        .get('/api/auth/verify-reset-token');

      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(false);
    });
  });
});