import { Response } from 'express';
import User from '../models/User';
import Transaction from '../models/Transaction';
import { AuthRequest } from '../middleware/authMiddleware';

export const depositFunds = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid deposit amount is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add to balance
    user.walletBalance = (user.walletBalance || 0) + Number(amount);
    await user.save();

    // Log transaction
    const transaction = new Transaction({
      userId,
      type: 'deposit',
      amount,
      status: 'Completed',
      description: `Simulated Stripe deposit of $${amount}`
    });
    await transaction.save();

    return res.status(200).json({
      balance: user.walletBalance,
      transaction
    });
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

export const withdrawFunds = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid withdrawal amount is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.walletBalance < amount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    // Subtract from balance
    user.walletBalance = user.walletBalance - Number(amount);
    await user.save();

    // Log transaction
    const transaction = new Transaction({
      userId,
      type: 'withdraw',
      amount,
      status: 'Completed',
      description: `Withdrew $${amount} to mock bank account`
    });
    await transaction.save();

    return res.status(200).json({
      balance: user.walletBalance,
      transaction
    });
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

export const transferFunds = async (req: AuthRequest, res: Response) => {
  try {
    const senderId = req.user?.id;
    const { recipientId, amount, description } = req.body;

    if (!recipientId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Recipient ID and valid transfer amount are required' });
    }

    if (senderId === recipientId) {
      return res.status(400).json({ error: 'Cannot transfer funds to yourself' });
    }

    const sender = await User.findById(senderId);
    if (!sender) {
      return res.status(404).json({ error: 'Sender not found' });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    if (sender.walletBalance < amount) {
      return res.status(400).json({ error: 'Insufficient funds for transfer' });
    }

    // Adjust balances
    sender.walletBalance = sender.walletBalance - Number(amount);
    recipient.walletBalance = (recipient.walletBalance || 0) + Number(amount);

    await sender.save();
    await recipient.save();

    // Log transaction
    const transaction = new Transaction({
      userId: senderId,
      recipientId,
      type: 'transfer',
      amount,
      status: 'Completed',
      description: description || `Transfer to ${recipient.name}`
    });
    await transaction.save();

    return res.status(200).json({
      balance: sender.walletBalance,
      transaction
    });
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

export const getTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Retrieve transactions where user is initiator or recipient
    const transactions = await Transaction.find({
      $or: [
        { userId },
        { recipientId: userId }
      ]
    })
      .populate('userId', 'name email avatarUrl role')
      .populate('recipientId', 'name email avatarUrl role')
      .sort({ createdAt: -1 });

    return res.status(200).json(transactions);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};
