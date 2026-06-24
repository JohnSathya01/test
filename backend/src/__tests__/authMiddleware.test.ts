import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../middleware/auth';

const TEST_JWT_SECRET = 'test-jwt-secret';

// Test app with verifyToken middleware
const app = express();
app.use(express.json());

// Protected route for testing
app.get('/protected', verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

describe('Auth Middleware (verifyToken)', () => {
  test('should allow access with valid Bearer token', async () => {
    const token = jwt.sign({ id: 'user123', email: 'test@example.com' }, TEST_JWT_SECRET, {
      expiresIn: '3d',
    });

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.id).toBe('user123');
    expect(res.body.user.email).toBe('test@example.com');
  });

  test('should return 401 when no Authorization header is provided', async () => {
    const res = await request(app).get('/protected');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('EX_7.1');
    expect(res.body.message).toBe('Access denied. No token provided.');
  });

  test('should return 401 when Authorization header does not start with Bearer', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Basic sometoken');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('EX_7.1');
  });

  test('should return 401 for invalid/malformed token', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer invalid-token-string');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('EX_7.1');
    expect(res.body.message).toBe('Invalid or expired token.');
  });

  test('should return 401 for expired token', async () => {
    const token = jwt.sign({ id: 'user123', email: 'test@example.com' }, TEST_JWT_SECRET, {
      expiresIn: '-1s',
    });

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('EX_7.1');
  });

  test('should return 401 for token signed with wrong secret', async () => {
    const token = jwt.sign({ id: 'user123', email: 'test@example.com' }, 'wrong-secret', {
      expiresIn: '3d',
    });

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('EX_7.1');
  });

  test('should return 401 when Bearer has no token after it', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer ');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});