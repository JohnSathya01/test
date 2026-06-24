import request from 'supertest';
import express from 'express';
import {
  loginValidators,
  forgotPasswordValidators,
  resetPasswordValidators,
  validate,
} from '../middleware/validators';

// Test app with validator chains
const app = express();
app.use(express.json());

// Login validation endpoint
app.post('/test/login', loginValidators, validate, (req, res) => {
  res.status(200).json({ success: true, body: req.body });
});

// Forgot password validation endpoint
app.post('/test/forgot-password', forgotPasswordValidators, validate, (req, res) => {
  res.status(200).json({ success: true, body: req.body });
});

// Reset password validation endpoint
app.post('/test/reset-password', resetPasswordValidators, validate, (req, res) => {
  res.status(200).json({ success: true, body: req.body });
});

describe('Validators Middleware', () => {
  describe('loginValidators', () => {
    test('should pass with valid email and password', async () => {
      const res = await request(app)
        .post('/test/login')
        .send({ email: 'test@example.com', password: 'Password123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('should return 400 with EX_7.1 for invalid email format', async () => {
      const res = await request(app)
        .post('/test/login')
        .send({ email: 'invalid-email', password: 'Password123!' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('EX_7.1');
      expect(res.body.message).toBe('Please enter a valid email address or password');
    });

    test('should return 400 with EX_7.1 for empty password', async () => {
      const res = await request(app)
        .post('/test/login')
        .send({ email: 'test@example.com', password: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('EX_7.1');
    });

    test('should return 400 with EX_7.1 for missing email field', async () => {
      const res = await request(app)
        .post('/test/login')
        .send({ password: 'Password123!' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('EX_7.1');
    });

    test('should return 400 with EX_7.1 for missing password field', async () => {
      const res = await request(app)
        .post('/test/login')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('EX_7.1');
    });

    test('should normalize email', async () => {
      const res = await request(app)
        .post('/test/login')
        .send({ email: 'Test@Example.com', password: 'Password123!' });

      expect(res.status).toBe(200);
      expect(res.body.body.email).toBe('test@example.com');
    });
  });

  describe('forgotPasswordValidators', () => {
    test('should pass with valid email', async () => {
      const res = await request(app)
        .post('/test/forgot-password')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('should return 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/test/forgot-password')
        .send({ email: 'invalid-email' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Please enter a valid email address');
    });

    test('should return 400 for missing email', async () => {
      const res = await request(app)
        .post('/test/forgot-password')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('resetPasswordValidators', () => {
    test('should pass with valid token, newPassword, and confirmPassword', async () => {
      const res = await request(app)
        .post('/test/reset-password')
        .send({
          token: 'valid-token',
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('should return 400 for missing token', async () => {
      const res = await request(app)
        .post('/test/reset-password')
        .send({
          newPassword: 'NewPassword123!',
          confirmPassword: 'NewPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Reset token is required');
    });

    test('should return 400 for password shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/test/reset-password')
        .send({
          token: 'valid-token',
          newPassword: 'Short1!',
          confirmPassword: 'Short1!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Password does not meet requirements.');
    });

    test('should return 400 for password without uppercase letter', async () => {
      const res = await request(app)
        .post('/test/reset-password')
        .send({
          token: 'valid-token',
          newPassword: 'password123!',
          confirmPassword: 'password123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Password does not meet requirements.');
    });

    test('should return 400 for password without lowercase letter', async () => {
      const res = await request(app)
        .post('/test/reset-password')
        .send({
          token: 'valid-token',
          newPassword: 'PASSWORD123!',
          confirmPassword: 'PASSWORD123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Password does not meet requirements.');
    });

    test('should return 400 for password without a number', async () => {
      const res = await request(app)
        .post('/test/reset-password')
        .send({
          token: 'valid-token',
          newPassword: 'Password!!!',
          confirmPassword: 'Password!!!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Password does not meet requirements.');
    });

    test('should return 400 for password without special character', async () => {
      const res = await request(app)
        .post('/test/reset-password')
        .send({
          token: 'valid-token',
          newPassword: 'Password123',
          confirmPassword: 'Password123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Password does not meet requirements.');
    });

    test('should return 400 with EX_7.4 for password mismatch', async () => {
      const res = await request(app)
        .post('/test/reset-password')
        .send({
          token: 'valid-token',
          newPassword: 'NewPassword123!',
          confirmPassword: 'DifferentPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('EX_7.4');
      expect(res.body.message).toBe('Passwords do not match. Please re-enter.');
    });
  });
});