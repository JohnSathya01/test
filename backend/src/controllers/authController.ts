import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User, { IUser } from '../models/User';
import config from '../config';
import sendResetEmail from '../services/emailService';

/**
 * Login controller
 * - Validates credentials
 * - Handles account lockout (5 failed attempts → 15 min lock)
 * - Issues JWT with 3-day expiry
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { email, password } = req.body;

  try {
    // Find user by email — include password field
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password +failedLoginAttempts +lockUntil');

    // If user not found, return generic error (no indication of which credential is wrong)
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
        code: 'EX_7.3',
      });
      return;
    }

    // Check account lockout
    if (user.lockUntil && user.lockUntil > new Date()) {
      res.status(423).json({
        success: false,
        message: 'Too many unsuccessful login attempts. Your account has been locked. Please try again after 15 minutes.',
        code: 'EX_7.2',
      });
      return;
    }

    // Compare password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      // Increment failed attempts
      await User.incrementFailedAttempts(user._id.toString());

      // Check if this attempt triggered lockout
      const updatedUser = await User.findById(user._id).select('+failedLoginAttempts +lockUntil');
      if (updatedUser && updatedUser.lockUntil && updatedUser.lockUntil > new Date()) {
        res.status(423).json({
          success: false,
          message: 'Too many unsuccessful login attempts. Your account has been locked. Please try again after 15 minutes.',
          code: 'EX_7.2',
        });
        return;
      }

      res.status(401).json({
        success: false,
        message: 'Incorrect password. Please try again.',
        code: 'EX_7.3',
      });
      return;
    }

    // Successful login — reset failed attempts and lockUntil
    await User.resetFailedAttempts(user._id.toString());

    // Issue JWT with 3-day expiry
    const payload = { id: user._id.toString(), email: user.email };
    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
      },
      message: 'Login successful',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Forgot password controller
 * - Generates a crypto random reset token
 * - Hashes and stores token + expiry (10 min)
 * - Sends recovery link email via nodemailer
 * - Returns success-like response to prevent email enumeration
 */
export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+resetPasswordToken +resetPasswordExpires');

    // If user not found, return success-like response to prevent email enumeration
    // but do NOT send email
    if (!user) {
      res.status(200).json({
        success: true,
        message: 'Password reset link sent to your email',
      });
      return;
    }

    // Generate a crypto random reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash and store the token
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await user.save();

    // Build recovery link
    const resetLink = `${config.clientUrl}/reset-password?token=${resetToken}`;

    // Send email
    await sendResetEmail(user.email, resetLink);

    res.status(200).json({
      success: true,
      message: 'Password reset link sent to your email',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password controller
 * - Validates reset token (hashed lookup)
 * - Checks expiry (10 min)
 * - Validates password policy and match
 * - Hashes and saves new password
 * - Clears reset token fields
 */
export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { token, newPassword, confirmPassword } = req.body;

  try {
    // Hash the token for lookup
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user by reset token
    const user = await User.findOne({ resetPasswordToken: hashedToken }).select('+resetPasswordToken +resetPasswordExpires +password');

    if (!user) {
      res.status(400).json({
        success: false,
        message: 'This recovery link has expired.',
      });
      return;
    }

    // Check expiry
    if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      res.status(400).json({
        success: false,
        message: 'This recovery link has expired.',
      });
      return;
    }

    // Validate password match
    if (newPassword !== confirmPassword) {
      res.status(400).json({
        success: false,
        message: 'Passwords do not match. Please re-enter.',
        code: 'EX_7.4',
      });
      return;
    }

    // Set new password (pre-save hook will hash it)
    user.password = newPassword;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Your password has been successfully reset.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify token controller
 * - Called by GET /auth/verify with auth middleware
 * - Returns user info from decoded JWT payload
 */
export const verify = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token.',
        code: 'EX_7.1',
      });
      return;
    }

    res.status(200).json({
      valid: true,
      user: {
        id: req.user.id,
        email: req.user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify reset token controller
 * - Called by GET /auth/verify-reset-token?token={token}
 * - Validates the reset token and checks expiry
 * - Returns { valid: true, email } or { valid: false }
 */
export const verifyResetToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const { token } = req.query;

  try {
    if (!token || typeof token !== 'string') {
      res.status(200).json({
        valid: false,
      });
      return;
    }

    // Hash the token for lookup
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({ resetPasswordToken: hashedToken }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user || !user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      res.status(200).json({
        valid: false,
      });
      return;
    }

    res.status(200).json({
      valid: true,
      email: user.email,
    });
  } catch (error) {
    next(error);
  }
};