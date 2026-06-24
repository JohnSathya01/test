import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  login,
  forgotPassword,
  resetPassword,
  verify,
  verifyResetToken,
} from '../controllers/authController';
import { verifyToken } from '../middleware/auth';
import {
  loginValidators,
  forgotPasswordValidators,
  resetPasswordValidators,
  validate,
} from '../middleware/validators';

const router = Router();

// Rate limiter for login route: 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: 'Too many login attempts from this IP, please try again after 15 minutes.',
    code: 'EX_7.2',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/login
router.post('/login', loginLimiter, loginValidators, validate, login);

// POST /api/auth/forgot-password
router.post('/forgot-password', forgotPasswordValidators, validate, forgotPassword);

// POST /api/auth/reset-password
router.post('/reset-password', resetPasswordValidators, validate, resetPassword);

// GET /api/auth/verify
router.get('/verify', verifyToken, verify);

// GET /api/auth/verify-reset-token?token={token}
router.get('/verify-reset-token', verifyResetToken);

export default router;