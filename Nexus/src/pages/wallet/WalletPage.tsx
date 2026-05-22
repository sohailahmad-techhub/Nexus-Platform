import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Wallet, ArrowDownRight, ArrowUpRight, Send, RefreshCw, Landmark } from 'lucide-react';
import toast from 'react-hot-toast';

interface UserDirectoryItem {
  id: string;
  name: string;
  email: string;
  role: 'entrepreneur' | 'investor';
  startupName?: string;
}

interface TransactionItem {
  id: string;
  userId: {
    id: string;
    name: string;
    role: string;
  };
  recipientId?: {
    id: string;
    name: string;
    role: string;
  };
  type: 'deposit' | 'withdraw' | 'transfer';
  amount: number;
  status: 'Pending' | 'Completed' | 'Failed';
  description: string;
  createdAt: string;
}

export const WalletPage: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [balance, setBalance] = useState(user?.walletBalance || 0);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [usersList, setUsersList] = useState<UserDirectoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Forms State
  const [depositAmount, setDepositAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const [transferAmount, setTransferAmount] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState('');
  const [transferDescription, setTransferDescription] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  const loadWalletData = async () => {
    try {
      // 1. Load active profile to check current balance
      if (user) {
        const profileRes = await api.get(`/auth/profile/${user.id}`);
        setBalance(profileRes.data.walletBalance || 0);
      }
      
      // 2. Load transactions
      const txRes = await api.get('/payments/transactions');
      setTransactions(txRes.data);

      // 3. Load other users on platform for transfer dropdown
      const usersRes = await api.get('/auth/users');
      const filtered = usersRes.data.filter((u: UserDirectoryItem) => u.id !== user?.id);
      setUsersList(filtered);
      if (filtered.length > 0) {
        setSelectedRecipientId(filtered[0].id);
      }
    } catch (err: any) {
      toast.error('Failed to sync wallet data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadWalletData();
    }
  }, [user]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid deposit amount');
      return;
    }

    setIsDepositing(true);
    try {
      const res = await api.post('/payments/deposit', { amount: amt });
      setBalance(res.data.balance);
      setDepositAmount('');
      toast.success(`Successfully deposited $${amt.toLocaleString()}!`);
      loadWalletData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Deposit failed');
    } finally {
      setIsDepositing(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid withdrawal amount');
      return;
    }

    if (balance < amt) {
      toast.error('Insufficient wallet balance');
      return;
    }

    setIsWithdrawing(true);
    try {
      const res = await api.post('/payments/withdraw', { amount: amt });
      setBalance(res.data.balance);
      setWithdrawAmount('');
      toast.success(`Successfully withdrew $${amt.toLocaleString()} to bank account!`);
      loadWalletData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Withdrawal failed');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(transferAmount);
    if (!selectedRecipientId) {
      toast.error('Please select a transfer recipient');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      toast.error('Enter a valid transfer amount');
      return;
    }

    if (balance < amt) {
      toast.error('Insufficient funds for transfer');
      return;
    }

    setIsTransferring(true);
    try {
      const res = await api.post('/payments/transfer', {
        recipientId: selectedRecipientId,
        amount: amt,
        description: transferDescription || undefined
      });
      setBalance(res.data.balance);
      setTransferAmount('');
      setTransferDescription('');
      toast.success('Funds transferred successfully!');
      loadWalletData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Transfer failed');
    } finally {
      setIsTransferring(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-display">Wallet & Payments</h1>
        <p className="text-gray-600">Manage your simulated deposits, withdrawals, and venture funding transfers</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Glassmorphic Debit Card & Deposit/Withdraw */}
        <div className="lg:col-span-1 space-y-6">
          {/* Glowing Virtual Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-750 to-primary-900 text-white p-6 shadow-xl border border-primary-700 min-h-[200px] flex flex-col justify-between">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-primary-200 uppercase tracking-widest font-semibold">Nexus Account Balance</p>
                <h2 className="text-3xl font-extrabold mt-1 text-white leading-none">
                  ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
              </div>
              <div className="bg-white/10 p-2.5 rounded-lg border border-white/10">
                <Wallet className="w-6 h-6 text-white" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold text-primary-200 tracking-widest">
                •••• •••• •••• {user?.id.slice(-4).toUpperCase()}
              </div>
              <div className="flex justify-between items-center text-xs text-primary-300">
                <div>
                  <p className="uppercase text-[9px] font-bold text-primary-400">Cardholder</p>
                  <p className="font-bold text-white mt-0.5">{user?.name}</p>
                </div>
                <div className="text-right">
                  <p className="uppercase text-[9px] font-bold text-primary-400">Venture Role</p>
                  <p className="font-bold text-white capitalize mt-0.5">{user?.role}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Simulation Actions */}
          <Card>
            <CardHeader>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Landmark size={16} className="text-primary-600" />
                Deposit / Withdraw Funds
              </h3>
            </CardHeader>
            <CardBody className="space-y-6">
              {/* Deposit form */}
              <form onSubmit={handleDeposit} className="space-y-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input
                      label="Simulate Deposit (Stripe)"
                      type="number"
                      placeholder="Amount ($)"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      required
                    />
                  </div>
                  <Button variant="primary" type="submit" isLoading={isDepositing}>
                    Deposit
                  </Button>
                </div>
              </form>

              {/* Withdraw form */}
              <form onSubmit={handleWithdraw} className="space-y-3 pt-4 border-t border-gray-150">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input
                      label="Withdraw to Bank Account"
                      type="number"
                      placeholder="Amount ($)"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      required
                    />
                  </div>
                  <Button variant="outline" type="submit" isLoading={isWithdrawing}>
                    Withdraw
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>

        {/* Right Column: direct transfers and transaction logs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transfer Funds Box */}
          <Card>
            <CardHeader>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Send size={16} className="text-accent-500" />
                Transfer Funds to Partner
              </h3>
            </CardHeader>
            <CardBody>
              <form onSubmit={handleTransfer} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Recipient Name</label>
                    {usersList.length > 0 ? (
                      <select
                        className="w-full border border-gray-300 rounded-md p-2 text-sm bg-white"
                        value={selectedRecipientId}
                        onChange={(e) => setSelectedRecipientId(e.target.value)}
                      >
                        {usersList.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role === 'investor' ? 'Investor' : u.startupName || 'Entrepreneur'})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-error-600 bg-error-50 p-2.5 rounded border border-error-100 font-medium">
                        No other users found on the platform to transfer funds to.
                      </p>
                    )}
                  </div>

                  <Input
                    label="Transfer Amount ($)"
                    type="number"
                    placeholder="Enter amount to transfer"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    required
                  />
                </div>

                <Input
                  label="Description / Funding Purpose"
                  placeholder="e.g. Initial seed round tranche, pitch ticket booking"
                  value={transferDescription}
                  onChange={(e) => setTransferDescription(e.target.value)}
                />

                <div className="flex justify-end pt-2">
                  <Button variant="accent" type="submit" isLoading={isTransferring} disabled={usersList.length === 0}>
                    Execute Transfer
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>

          {/* Ledger History List */}
          <Card>
            <CardHeader className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-900">Transaction History Ledger</h3>
              <button 
                onClick={loadWalletData}
                className="p-1.5 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700 transition"
              >
                <RefreshCw size={14} />
              </button>
            </CardHeader>
            <CardBody>
              {transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500 font-semibold text-xs uppercase bg-gray-50/50">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-700">
                      {transactions.map((tx) => {
                        const isDebit = tx.type === 'withdraw' || (tx.type === 'transfer' && tx.userId.id === user?.id);
                        
                        return (
                          <tr key={tx.id} className="hover:bg-gray-50/40">
                            <td className="py-3 px-3 text-xs text-gray-500 whitespace-nowrap">
                              {new Date(tx.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-3">
                              <p className="font-semibold text-gray-900 text-xs md:text-sm">{tx.description}</p>
                              <p className="text-[10px] text-gray-400 capitalize">
                                Type: {tx.type} • {tx.type === 'transfer' ? (isDebit ? `To: ${tx.recipientId?.name}` : `From: ${tx.userId?.name}`) : 'Direct Wallet'}
                              </p>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                                tx.status === 'Completed' ? 'bg-success-100 text-success-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {tx.status}
                              </span>
                            </td>
                            <td className={`py-3 px-3 font-bold text-right text-sm whitespace-nowrap ${
                              isDebit ? 'text-error-600' : 'text-success-600'
                            }`}>
                              {isDebit ? '-' : '+'}${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 text-xs">
                  No transaction ledger logs found
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
