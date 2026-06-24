import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  password: string;
  failedLoginAttempts: number;
  lockUntil: Date | null;
  resetPasswordToken: string | null;
  resetPasswordExpires: Date | null;
  comparePassword(candidate: string): Promise<boolean>;
}

export interface IUserModel extends Model<IUser> {
  incrementFailedAttempts(userId: string): Promise<IUser | null>;
  resetFailedAttempts(userId: string): Promise<void>;
}

const userSchema = new Schema<IUser, IUserModel>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    resetPasswordToken: {
      type: String,
      default: null,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
      select: false,
    },
  },
  { timestamps: true }
);

// Pre-save hook to hash password
userSchema.pre<IUser>('save', async function (next) {
  const user = this as IUser;

  // Only hash the password if it has been modified (or is new)
  if (!user.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Instance method to compare password
userSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidate, this.password);
  } catch (error) {
    return false;
  }
};

// Static method to increment failed attempts and lock account if threshold reached
userSchema.statics.incrementFailedAttempts = async function (userId: string): Promise<IUser | null> {
  const user = await this.findById(userId).select('+password +failedLoginAttempts +lockUntil');
  if (!user) return null;

  user.failedLoginAttempts += 1;

  // Lock account after 5 consecutive failed attempts
  if (user.failedLoginAttempts >= 5) {
    user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  }

  await user.save();
  return user;
};

// Static method to reset failed attempts on successful login
userSchema.statics.resetFailedAttempts = async function (userId: string): Promise<void> {
  await this.findByIdAndUpdate(userId, {
    failedLoginAttempts: 0,
    lockUntil: null,
  });
};

const User = mongoose.model<IUser, IUserModel>('User', userSchema);

export default User;