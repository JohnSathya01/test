import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';

// Validation result checker middleware
export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const firstError = errors.array()[0];
    const isPasswordMismatch = firstError.msg.includes('match');

    res.status(400).json({
      success: false,
      message: firstError.msg,
      code: isPasswordMismatch ? 'EX_7.4' : 'EX_7.1',
    });
    return;
  }

  next();
};

// Login validation chain
export const loginValidators = [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email address or password')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Please enter a valid email address or password'),
];

// Forgot password validation chain
export const forgotPasswordValidators = [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),
];

// Reset password validation chain
export const resetPasswordValidators = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password does not meet requirements.')
    .matches(/[A-Z]/)
    .withMessage('Password does not meet requirements.')
    .matches(/[a-z]/)
    .withMessage('Password does not meet requirements.')
    .matches(/\d/)
    .withMessage('Password does not meet requirements.')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('Password does not meet requirements.'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match. Please re-enter.');
      }
      return true;
    }),
];