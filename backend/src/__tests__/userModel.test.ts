import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import User from '../models/User';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
});

describe('User Model', () => {
  describe('Password hashing (pre-save hook)', () => {
    test('should hash the password on save', async () => {
      const user = new User({ email: 'test@example.com', password: 'Password123!' });
      await user.save();

      expect(user.password).not.toBe('Password123!');
      expect(user.password.length).toBeGreaterThan(20);
    });

    test('should not rehash password if not modified', async () => {
      const user = new User({ email: 'test@example.com', password: 'Password123!' });
      await user.save();
      const originalHash = user.password;

      user.email = 'changed@example.com';
      await user.save();

      const updatedUser = await User.findById(user._id).select('+password');
      expect(updatedUser?.password).toBe(originalHash);
    });
  });

  describe('comparePassword', () => {
    test('should return true for correct password', async () => {
      const user = new User({ email: 'test@example.com', password: 'Password123!' });
      await user.save();

      const isMatch = await user.comparePassword('Password123!');
      expect(isMatch).toBe(true);
    });

    test('should return false for incorrect password', async () => {
      const user = new User({ email: 'test@example.com', password: 'Password123!' });
      await user.save();

      const isMatch = await user.comparePassword('WrongPassword123!');
      expect(isMatch).toBe(false);
    });
  });

  describe('incrementFailedAttempts', () => {
    test('should increment failedLoginAttempts by 1', async () => {
      const user = new User({ email: 'test@example.com', password: 'Password123!' });
      await user.save();

      await User.incrementFailedAttempts(user._id.toString());

      const updatedUser = await User.findById(user._id).select('+failedLoginAttempts');
      expect(updatedUser?.failedLoginAttempts).toBe(1);
    });

    test('should lock account after 5 failed attempts', async () => {
      const user = new User({ email: 'test@example.com', password: 'Password123!' });
      await user.save();

      for (let i = 0; i < 5; i++) {
        await User.incrementFailedAttempts(user._id.toString());
      }

      const updatedUser = await User.findById(user._id).select('+failedLoginAttempts +lockUntil');
      expect(updatedUser?.failedLoginAttempts).toBe(5);
      expect(updatedUser?.lockUntil).not.toBeNull();
      expect(updatedUser?.lockUntil instanceof Date).toBe(true);
    });

    test('should not lock account before 5 failed attempts', async () => {
      const user = new User({ email: 'test@example.com', password: 'Password123!' });
      await user.save();

      for (let i = 0; i < 4; i++) {
        await User.incrementFailedAttempts(user._id.toString());
      }

      const updatedUser = await User.findById(user._id).select('+failedLoginAttempts +lockUntil');
      expect(updatedUser?.failedLoginAttempts).toBe(4);
      expect(updatedUser?.lockUntil).toBeNull();
    });

    test('should return null for non-existent user', async () => {
      const result = await User.incrementFailedAttempts(new mongoose.Types.ObjectId().toString());
      expect(result).toBeNull();
    });
  });

  describe('resetFailedAttempts', () => {
    test('should reset failedLoginAttempts to 0 and clear lockUntil', async () => {
      const user = new User({ email: 'test@example.com', password: 'Password123!' });
      await user.save();

      // Set some failed attempts and lock
      for (let i = 0; i < 5; i++) {
        await User.incrementFailedAttempts(user._id.toString());
      }

      // Reset
      await User.resetFailedAttempts(user._id.toString());

      const updatedUser = await User.findById(user._id).select('+failedLoginAttempts +lockUntil');
      expect(updatedUser?.failedLoginAttempts).toBe(0);
      expect(updatedUser?.lockUntil).toBeNull();
    });
  });

  describe('Schema fields and defaults', () => {
    test('should lowercase and trim email', async () => {
      const user = new User({ email: '  Test@Example.COM  ', password: 'Password123!' });
      await user.save();

      expect(user.email).toBe('test@example.com');
    });

    test('should default failedLoginAttempts to 0', async () => {
      const user = new User({ email: 'test@example.com', password: 'Password123!' });
      await user.save();

      expect(user.failedLoginAttempts).toBe(0);
    });

    test('should default lockUntil to null', async () => {
      const user = new User({ email: 'test@example.com', password: 'Password123!' });
      await user.save();

      expect(user.lockUntil).toBeNull();
    });

    test('should default resetPasswordToken to null', async () => {
      const user = new User({ email: 'test@example.com', password: 'Password123!' });
      await user.save();

      expect(user.resetPasswordToken).toBeNull();
    });

    test('should default resetPasswordExpires to null', async () => {
      const user = new User({ email: 'test@example.com', password: 'Password123!' });
      await user.save();

      expect(user.resetPasswordExpires).toBeNull();
    });

    test('should enforce unique email constraint', async () => {
      const user1 = new User({ email: 'test@example.com', password: 'Password123!' });
      await user1.save();

      const user2 = new User({ email: 'test@example.com', password: 'Password456!' });
      await expect(user2.save()).rejects.toThrow();
    });

    test('should require email field', async () => {
      const user = new User({ password: 'Password123!' } as any);
      await expect(user.save()).rejects.toThrow();
    });

    test('should require password field', async () => {
      const user = new User({ email: 'test@example.com' } as any);
      await expect(user.save()).rejects.toThrow();
    });

    test('should have timestamps', async () => {
      const user = new User({ email: 'test@example.com', password: 'Password123!' });
      await user.save();

      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });
  });

  describe('Password field select', () => {
    test('should not include password in default query', async () => {
      const user = new User({ email: 'test@example.com', password: 'Password123!' });
      await user.save();

      const foundUser = await User.findById(user._id);
      expect(foundUser?.password).toBeUndefined();
    });

    test('should include password when explicitly selected', async () => {
      const user = new User({ email: 'test@example.com', password: 'Password123!' });
      await user.save();

      const foundUser = await User.findById(user._id).select('+password');
      expect(foundUser?.password).toBeDefined();
    });
  });
});