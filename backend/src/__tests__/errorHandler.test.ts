import request from 'supertest';
import express from 'express';
import { errorHandler, AppError } from '../middleware/errorHandler';

// Test app to exercise the error handler
const app = express();
app.use(express.json());

// Route that throws a known error with statusCode and code
app.get('/known-error', (_req, _res, next) => {
  const err: AppError = new Error('Custom known error');
  err.statusCode = 403;
  err.code = 'CUSTOM_CODE';
  next(err);
});

// Route that throws a generic error (no statusCode)
app.get('/generic-error', (_req, _res, next) => {
  next(new Error('Something went wrong'));
});

app.use(errorHandler);

describe('Error Handler Middleware', () => {
  test('should respond with custom statusCode and code when provided', async () => {
    const res = await request(app).get('/known-error');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Custom known error');
    expect(res.body.code).toBe('CUSTOM_CODE');
  });

  test('should default to 500 when statusCode is not set', async () => {
    const res = await request(app).get('/generic-error');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Something went wrong');
    expect(res.body.code).toBeUndefined();
  });
});