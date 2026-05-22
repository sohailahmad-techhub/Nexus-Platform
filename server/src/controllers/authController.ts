import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { AuthRequest } from '../middleware/authMiddleware';

const generateToken = (userId: string, role: string): string => {
  const secret = process.env.JWT_SECRET || 'nexus_secret_key_2026';
  return jwt.sign({ id: userId, role }, secret, { expiresIn: '7d' });
};

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (role !== 'entrepreneur' && role !== 'investor') {
      return res.status(400).json({ error: 'Invalid user role' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=128`;

    const user = new User({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role,
      avatarUrl,
      walletBalance: 10000 // default mock balance
    });

    await user.save();
    const token = generateToken(user.id, user.role);

    return res.status(201).json({
      token,
      user
    });
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Email, password and role are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase(), role });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (user.twoFactorEnabled) {
      // Generate OTP code
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.twoFactorCode = otp;
      user.twoFactorExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
      await user.save();

      // Print OTP code to terminal for verification/simulation
      console.log('\n======================================');
      console.log(`[2FA OTP] Code for user ${user.email}: ${otp}`);
      console.log('======================================\n');

      return res.status(200).json({
        require2FA: true,
        userId: user.id,
        email: user.email
      });
    }

    const token = generateToken(user.id, user.role);
    user.isOnline = true;
    await user.save();

    return res.status(200).json({
      token,
      user
    });
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

export const verify2FA = async (req: Request, res: Response) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({ error: 'User ID and OTP code are required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.twoFactorCode || user.twoFactorCode !== code) {
      return res.status(400).json({ error: 'Invalid OTP code' });
    }

    if (user.twoFactorExpires && user.twoFactorExpires < new Date()) {
      return res.status(400).json({ error: 'OTP code expired' });
    }

    // Reset code
    user.twoFactorCode = undefined;
    user.twoFactorExpires = undefined;
    user.isOnline = true;
    await user.save();

    const token = generateToken(user.id, user.role);

    return res.status(200).json({
      token,
      user
    });
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    // Ensure user is updating their own profile
    if (req.user?.id !== id) {
      return res.status(403).json({ error: 'Unauthorized profile update' });
    }

    const updates = req.body;
    
    // Remove fields that should not be updated directly
    delete updates.email;
    delete updates.passwordHash;
    delete updates.role;
    delete updates.twoFactorCode;
    delete updates.twoFactorExpires;
    delete updates.walletBalance;

    const user = await User.findByIdAndUpdate(id, { $set: updates }, { new: true });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

export const toggle2FA = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { enable } = req.body;

    if (enable === undefined) {
      return res.status(400).json({ error: 'enable field is required' });
    }

    const user = await User.findByIdAndUpdate(userId, { twoFactorEnabled: enable }, { new: true });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      message: `2FA successfully ${enable ? 'enabled' : 'disabled'}`,
      twoFactorEnabled: user.twoFactorEnabled
    });
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const users = await User.find({});
    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // In a real app, calculate actual metrics. Here we aggregate or return user properties.
    return res.status(200).json({
      walletBalance: user.walletBalance,
      twoFactorEnabled: user.twoFactorEnabled
    });
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};
