import nodemailer from 'nodemailer';
import config from '../config';

// Create transporter using SMTP config from env vars
const createTransporter = () => {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });
};

/**
 * Send a password reset email containing the recovery link.
 * Handles errors gracefully — logs but does not crash the request.
 */
export const sendResetEmail = async (toEmail: string, resetLink: string): Promise<void> => {
  try {
    const transporter = createTransporter();

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Reset Your Password</h2>
        <p style="color: #6b7280; font-size: 16px;">
          We received a request to reset your password. Click the button below to set a new password:
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          Or copy and paste this link into your browser:
        </p>
        <p style="color: #667eea; font-size: 14px; word-break: break-all;">
          ${resetLink}
        </p>
        <p style="color: #9ca3af; font-size: 12px;">
          This link will expire in 10 minutes. If you did not request a password reset, please ignore this email.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: config.smtpFrom,
      to: toEmail,
      subject: 'SoundryAI — Password Reset',
      html,
    });
  } catch (error) {
    // Log error but don't crash the request
    console.error('Failed to send reset email:', error);
  }
};

export default sendResetEmail;