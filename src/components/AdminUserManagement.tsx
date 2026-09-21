import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  ShieldAlert, 
  ShieldCheck, 
  UserCheck, 
  UserX, 
  DollarSign, 
  TrendingUp, 
  Filter, 
  RefreshCw, 
  ArrowUpDown, 
  Eye, 
  Plus, 
  Minus, 
  AlertTriangle, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  Wallet, 
  Copy, 
  Check, 
  X,
  Phone,
  Mail,
  Calendar,
  Layers,
  ArrowUpRight,
  Sparkles,
  Flame,
  Trash2,
  KeyRound
} from 'lucide-react';
import { UserProfile, Transaction, ActiveInvestment } from '../types';
import { authApi } from '../services/authApi';
import { transactionsApi, investmentsApi } from '../services/api';

interface AdminUserManagementProps {
  currentAdmin?: UserProfile;
  onRefreshParent?: () => void;
}

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ 
  currentAdmin,
  onRefreshParent 
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'frozen'>('all');
  const [kycFilter, setKycFilter] = useState<'all' | 'REQUIRED' | 'SUBMITTED' | 'APPROVED' | 'NOT_REQUIRED' | 'REJECTED'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin' | 'support'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'highest_balance' | 'highest_invested' | 'highest_risk'>('newest');

  // Active Modals State
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<UserProfile | null>(null);
  const [userDetailTxns, setUserDetailTxns] = useState<Transaction[]>([]);
  const [userDetailInvestments, setUserDetailInvestments] = useState<ActiveInvestment[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const [adjustBalanceUser, setAdjustBalanceUser] = useState<UserProfile | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number | ''>('');
  const [adjustAction, setAdjustAction] = useState<'add' | 'deduct'>('add');
  const [adjustType, setAdjustType] = useState<'wallet' | 'invested'>('wallet');
  const [adjustReason, setAdjustReason] = useState<string>('Manual administrative adjustment');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  const [banModalUser, setBanModalUser] = useState<UserProfile | null>(null);
  const [banReason, setBanReason] = useState<string>('Risk compliance review');
  const [isSubmittingBan, setIsSubmittingBan] = useState(false);

  const [kycModalUser, setKycModalUser] = useState<UserProfile | null>(null);
  const [selectedKycStatus, setSelectedKycStatus] = useState<'REQUIRED' | 'NOT_REQUIRED' | 'APPROVED' | 'REJECTED'>('REQUIRED');
  const [kycReason, setKycReason] = useState<string>('Identity verification required for compliance');
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);

  const [wipeModalUser, setWipeModalUser] = useState<UserProfile | null>(null);
  const [wipeActionType, setWipeActionType] = useState<'violation_assets' | 'failed_tx' | 'all_tx' | 'user_logs' | 'clean_slate'>('violation_assets');
  const [wipeReason, setWipeReason] = useState<string>('Terms of Service Violation: Fake deposits & unauthorized exploit');
  const [isSubmittingWipe, setIsSubmittingWipe] = useState(false);

  const [resetPassModalUser, setResetPassModalUser] = useState<UserProfile | null>(null);
  const [newPassInput, setNewPassInput] = useState<string>('');
  const [isSubmittingPass, setIsSubmittingPass] = useState(false);

  const [isWipingGlobalFailed, setIsWipingGlobalFailed] = useState(false);
  const [isWipingGlobalSecurity, setIsWipingGlobalSecurity] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await authApi.getAllUsers();
      setUsers(data || []);
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
      setError(err.message || 'Could not load users list');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered and Sorted Users
  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => {
        // Search
        if (searchTerm.trim()) {
          const s = searchTerm.toLowerCase();
          const matchName = u.name?.toLowerCase().includes(s);
          const matchEmail = u.email?.toLowerCase().includes(s);
          const matchPhone = u.phone?.toLowerCase().includes(s);
          const matchRef = u.referralCode?.toLowerCase().includes(s);
          const matchId = u.id?.toLowerCase().includes(s);
          if (!matchName && !matchEmail && !matchPhone && !matchRef && !matchId) {
            return false;
          }
        }

        // Status Filter
        if (statusFilter === 'active' && u.isFrozen) return false;
        if (statusFilter === 'frozen' && !u.isFrozen) return false;

        // KYC Filter
        if (kycFilter !== 'all' && u.kycStatus !== kycFilter) return false;

        // Role Filter
        if (roleFilter !== 'all' && u.role !== roleFilter) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'highest_balance') {
          return (b.walletBalanceKES || 0) - (a.walletBalanceKES || 0);
        }
        if (sortBy === 'highest_invested') {
          return (b.investedCapitalKES || 0) - (a.investedCapitalKES || 0);
        }
        if (sortBy === 'highest_risk') {
          return (b.riskScore || 0) - (a.riskScore || 0);
        }
        // default newest
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
  }, [users, searchTerm, statusFilter, kycFilter, roleFilter, sortBy]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalUsers = users.length;
    const activeUsers = users.filter((u) => !u.isFrozen).length;
    const frozenUsers = users.filter((u) => u.isFrozen).length;
    const flaggedKyc = users.filter((u) => u.kycStatus === 'REQUIRED' || u.kycStatus === 'SUBMITTED').length;
    const totalWallet = users.reduce((acc, u) => acc + (u.walletBalanceKES || 0), 0);
    const totalInvested = users.reduce((acc, u) => acc + (u.investedCapitalKES || 0), 0);

    return { totalUsers, activeUsers, frozenUsers, flaggedKyc, totalWallet, totalInvested };
  }, [users]);

  // Open User Detail Modal
  const openUserDetails = async (u: UserProfile) => {
    setSelectedUserForDetail(u);
    setIsLoadingDetails(true);
    try {
      const [txs, invs] = await Promise.all([
        transactionsApi.getUserTransactions(u.id).catch(() => []),
        investmentsApi.getUserInvestments(u.id).catch(() => [])
      ]);
      setUserDetailTxns(txs);
      setUserDetailInvestments(invs);
    } catch (err) {
      console.warn('Failed loading user transactions/investments:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Submit Balance Adjustment
  const handleBalanceAdjustment = async () => {
    if (!adjustBalanceUser || !adjustAmount || Number(adjustAmount) <= 0) {
      alert('Please enter a valid positive amount.');
      return;
    }

    setIsSubmittingAdjust(true);
    try {
      const res = await authApi.adjustBalance({
        userId: adjustBalanceUser.id,
        amountKES: Number(adjustAmount),
        action: adjustAction,
        type: adjustType,
        reason: adjustReason || 'Admin balance adjustment'
      });

      // Update in local list
      setUsers((prev) => prev.map((u) => (u.id === res.user.id ? { ...u, ...res.user } : u)));
      if (selectedUserForDetail?.id === res.user.id) {
        setSelectedUserForDetail({ ...selectedUserForDetail, ...res.user });
      }

      showToast(res.message || 'User balance updated successfully!');
      setAdjustBalanceUser(null);
      setAdjustAmount('');
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      alert(err.message || 'Failed to adjust balance');
    } finally {
      setIsSubmittingAdjust(false);
    }
  };

  // Submit Ban / Unban
  const handleToggleBan = async (user: UserProfile) => {
    if (!user.isFrozen) {
      // Prompt for reason modal
      setBanModalUser(user);
      setBanReason('Risk containment & administrative freeze');
    } else {
      // Unban directly
      if (!confirm(`Restore ${user.name}'s account to active standing?`)) return;
      try {
        const res = await authApi.unbanUser(user.id);
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, ...res.user, isFrozen: false, freezeReason: undefined } : u)));
        if (selectedUserForDetail?.id === user.id) {
          setSelectedUserForDetail((prev) => prev ? { ...prev, isFrozen: false, freezeReason: undefined } : null);
        }
        showToast(`Account ${user.name} restored to active standing!`);
        if (onRefreshParent) onRefreshParent();
      } catch (err: any) {
        alert(err.message || 'Failed to unban user');
      }
    }
  };

  const confirmBan = async () => {
    if (!banModalUser) return;
    setIsSubmittingBan(true);
    try {
      const res = await authApi.banUser(banModalUser.id, banReason);
      setUsers((prev) => prev.map((u) => (u.id === banModalUser.id ? { ...u, ...res.user, isFrozen: true, freezeReason: banReason } : u)));
      if (selectedUserForDetail?.id === banModalUser.id) {
        setSelectedUserForDetail((prev) => prev ? { ...prev, isFrozen: true, freezeReason: banReason } : null);
      }
      showToast(`Account ${banModalUser.name} has been frozen/banned.`);
      setBanModalUser(null);
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      alert(err.message || 'Failed to ban user');
    } finally {
      setIsSubmittingBan(false);
    }
  };

  // Submit KYC Flag
  const confirmKycFlag = async () => {
    if (!kycModalUser) return;
    setIsSubmittingKyc(true);
    try {
      const willApprove = selectedKycStatus === 'APPROVED';
      const res = await authApi.flagKyc({
        userId: kycModalUser.id,
        status: selectedKycStatus,
        reason: kycReason,
        riskScore: selectedKycStatus === 'REQUIRED' ? 65 : willApprove ? 10 : undefined,
        unfreeze: willApprove
      });
      setUsers((prev) => prev.map((u) => (u.id === kycModalUser.id ? { 
        ...u, 
        ...res.user,
        kycStatus: selectedKycStatus,
        isFrozen: willApprove ? false : (res.user?.isFrozen ?? u.isFrozen),
        freezeReason: willApprove ? undefined : (res.user?.freezeReason ?? u.freezeReason)
      } : u)));
      if (selectedUserForDetail?.id === kycModalUser.id) {
        setSelectedUserForDetail((prev) => prev ? { 
          ...prev, 
          ...res.user,
          kycStatus: selectedKycStatus,
          isFrozen: willApprove ? false : (res.user?.isFrozen ?? prev.isFrozen),
          freezeReason: willApprove ? undefined : (res.user?.freezeReason ?? prev.freezeReason)
        } : null);
      }
      showToast(`KYC status for ${kycModalUser.name} updated to ${selectedKycStatus}${willApprove ? ' and account restored to active standing!' : '.'}`);
      setKycModalUser(null);
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      alert(err.message || 'Failed to update KYC status');
    } finally {
      setIsSubmittingKyc(false);
    }
  };

  // Submit Wipe Action
  const confirmWipeAction = async () => {
    if (!wipeModalUser) return;
    setIsSubmittingWipe(true);
    try {
      if (wipeActionType === 'violation_assets') {
        const res = await authApi.violationWipe(wipeModalUser.id, wipeReason);
        setUsers((prev) => prev.map((u) => (u.id === wipeModalUser.id ? { 
          ...u, 
          ...res.user, 
          walletBalanceKES: 0, 
          investedCapitalKES: 0, 
          totalEarningsAccruedKES: 0, 
          isFrozen: true, 
          freezeReason: wipeReason 
        } : u)));
        if (selectedUserForDetail?.id === wipeModalUser.id) {
          setSelectedUserForDetail((prev) => prev ? { 
            ...prev, 
            ...res.user, 
            walletBalanceKES: 0, 
            investedCapitalKES: 0, 
            totalEarningsAccruedKES: 0, 
            isFrozen: true, 
            freezeReason: wipeReason 
          } : null);
          setUserDetailInvestments([]);
        }
        showToast(`Violation Wipe: Liquidated capital & froze account for ${wipeModalUser.name}.`);
      } else if (wipeActionType === 'failed_tx') {
        const res = await authApi.wipeFailedTransactions(wipeModalUser.id);
        if (selectedUserForDetail?.id === wipeModalUser.id) {
          setUserDetailTxns((prev) => prev.filter(t => t.status !== 'failed' && t.status !== 'rejected' && (t as any).status !== 'cancelled'));
        }
        showToast(`Wiped ${res.deletedCount} failed deposit / transaction records.`);
      } else if (wipeActionType === 'all_tx') {
        const res = await authApi.wipeAllUserTransactions(wipeModalUser.id);
        if (selectedUserForDetail?.id === wipeModalUser.id) {
          setUserDetailTxns([]);
        }
        showToast(`Wiped all ${res.deletedCount} transaction records for ${wipeModalUser.name}.`);
      } else if (wipeActionType === 'user_logs') {
        await authApi.wipeUserLogs(wipeModalUser.id);
        showToast(`Chat threads and security logs wiped for ${wipeModalUser.name}.`);
      } else if (wipeActionType === 'clean_slate') {
        const res = await authApi.resetUserAccount(wipeModalUser.id, wipeReason);
        setUsers((prev) => prev.map((u) => (u.id === wipeModalUser.id ? { ...u, ...res.user } : u)));
        if (selectedUserForDetail?.id === wipeModalUser.id) {
          setSelectedUserForDetail((prev) => prev ? { ...prev, ...res.user } : null);
          setUserDetailInvestments([]);
          setUserDetailTxns([]);
        }
        showToast(`Account for ${wipeModalUser.name} wiped and reset to clean slate.`);
      }

      // Dispatch local event for real-time app update
      window.dispatchEvent(new CustomEvent('royalservice_user_updated', { detail: { userId: wipeModalUser.id } }));
      localStorage.setItem('royalservice_last_wipe', Date.now().toString());

      setWipeModalUser(null);
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      alert(err.message || 'Failed to execute wipe operation');
    } finally {
      setIsSubmittingWipe(false);
    }
  };

  // Submit Password Reset
  const confirmPasswordReset = async () => {
    if (!resetPassModalUser || !newPassInput.trim()) return;
    setIsSubmittingPass(true);
    try {
      await authApi.resetUserPassword(resetPassModalUser.id, newPassInput.trim());
      showToast(`Password successfully updated for ${resetPassModalUser.name}!`);
      setResetPassModalUser(null);
      setNewPassInput('');
    } catch (err: any) {
      alert(err.message || 'Failed to reset password');
    } finally {
      setIsSubmittingPass(false);
    }
  };

  // Global Wipe Handlers
  const handleGlobalWipeFailedDeposits = async () => {
    if (!confirm('Are you sure you want to wipe ALL failed, cancelled, and rejected deposits across the entire platform?')) return;
    setIsWipingGlobalFailed(true);
    try {
      const res = await authApi.wipeFailedTransactions();
      showToast(`Platform Purge: Removed ${res.deletedCount} failed deposit records across system.`);
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      alert(err.message || 'Failed to wipe failed deposits');
    } finally {
      setIsWipingGlobalFailed(false);
    }
  };

  const handleGlobalWipeSecurityLogs = async () => {
    if (!confirm('Are you sure you want to clear all resolved Anti-Fraud & Risk security alert logs?')) return;
    setIsWipingGlobalSecurity(true);
    try {
      const res = await authApi.wipeAntiFraudLogs();
      showToast(`Security Purge: Cleared ${res.deletedCount} security logs.`);
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      alert(err.message || 'Failed to wipe security logs');
    } finally {
      setIsWipingGlobalSecurity(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-emerald-500 text-slate-950 px-4 py-3 rounded-xl shadow-2xl font-bold text-xs flex items-center gap-2 border border-emerald-400"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#0d1320] border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium">Total Users</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">{metrics.totalUsers}</div>
          <div className="text-[10px] text-slate-400 mt-1">Live in Database</div>
        </div>

        <div className="bg-[#0d1320] border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium">Active Standing</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 font-mono">{metrics.activeUsers}</div>
          <div className="text-[10px] text-slate-400 mt-1">Unrestricted</div>
        </div>

        <div className="bg-[#0d1320] border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium">Banned / Frozen</span>
            <UserX className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl font-bold text-rose-400 font-mono">{metrics.frozenUsers}</div>
          <div className="text-[10px] text-slate-400 mt-1">Kill switch engaged</div>
        </div>

        <div className="bg-[#0d1320] border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium">KYC Required</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-amber-400 font-mono">{metrics.flaggedKyc}</div>
          <div className="text-[10px] text-slate-400 mt-1">Flagged accounts</div>
        </div>

        <div className="bg-[#0d1320] border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium">Wallet Liquidity</span>
            <Wallet className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-sm sm:text-base font-bold text-cyan-300 font-mono truncate">
            KES {metrics.totalWallet.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Member Balances</div>
        </div>

        <div className="bg-[#0d1320] border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium">Active Capital</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-sm sm:text-base font-bold text-emerald-300 font-mono truncate">
            KES {metrics.totalInvested.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Under Contract</div>
        </div>
      </div>

      {/* Control Bar: Search & Filters */}
      <div className="bg-[#0d1320] border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, phone (+254...), referral code or user ID..."
            className="w-full bg-[#0a0e17] border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            aria-label="Filter users by account status"
            className="bg-[#0a0e17] border border-slate-700 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="all">Status: All</option>
            <option value="active">Active Only</option>
            <option value="frozen">Frozen / Banned</option>
          </select>

          {/* KYC Filter */}
          <select
            value={kycFilter}
            onChange={(e) => setKycFilter(e.target.value as any)}
            aria-label="Filter users by KYC verification status"
            className="bg-[#0a0e17] border border-slate-700 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="all">KYC: All</option>
            <option value="REQUIRED">Flagged / Required</option>
            <option value="SUBMITTED">Submitted / Pending</option>
            <option value="APPROVED">Verified / Approved</option>
            <option value="NOT_REQUIRED">Not Required</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            aria-label="Filter users by system role"
            className="bg-[#0a0e17] border border-slate-700 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="all">Role: All</option>
            <option value="user">Investors</option>
            <option value="support">Support Desk</option>
            <option value="admin">Admins</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            aria-label="Sort users by criteria"
            className="bg-[#0a0e17] border border-slate-700 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500"
          >
            <option value="newest">Sort: Newest Joined</option>
            <option value="highest_balance">Sort: Highest Wallet</option>
            <option value="highest_invested">Sort: Highest Invested</option>
            <option value="highest_risk">Sort: Highest Risk Score</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={fetchUsers}
            disabled={isLoading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1 text-xs"
            title="Reload from Neon DB"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-purple-400' : ''}`} />
          </button>

          {/* Global Wipe Failed Deposits */}
          <button
            onClick={handleGlobalWipeFailedDeposits}
            disabled={isWipingGlobalFailed}
            className="px-3 py-2 bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/40 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            title="Purge all failed, cancelled, or rejected deposits across the platform"
          >
            <Trash2 className={`w-3.5 h-3.5 text-red-400 ${isWipingGlobalFailed ? 'animate-pulse' : ''}`} />
            <span>Wipe Failed Deposits</span>
          </button>

          {/* Global Wipe Security Logs */}
          <button
            onClick={handleGlobalWipeSecurityLogs}
            disabled={isWipingGlobalSecurity}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            title="Clear all resolved Anti-Fraud & Risk security logs"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Wipe Security Logs</span>
          </button>
        </div>
      </div>

      {/* Users Table / List */}
      <div className="bg-[#0d1320] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Showing <strong className="text-white">{filteredUsers.length}</strong> of {users.length} registered accounts</span>
          {isLoading && <span className="text-purple-400 animate-pulse font-medium">Syncing with database...</span>}
        </div>

        {error && (
          <div className="p-6 text-center text-rose-400 text-xs space-y-2">
            <AlertTriangle className="w-6 h-6 mx-auto" />
            <div>{error}</div>
            <button
              onClick={fetchUsers}
              className="px-3 py-1 bg-rose-500/20 text-rose-300 rounded-lg font-bold hover:bg-rose-500/30 transition"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && filteredUsers.length === 0 && !error && (
          <div className="p-12 text-center text-slate-400 text-xs space-y-2">
            <Users className="w-8 h-8 mx-auto text-slate-600" />
            <div className="font-semibold text-slate-300">No users match your criteria</div>
            <p className="text-slate-500 max-w-sm mx-auto">
              Try adjusting your search keywords, role filters, or clearing status constraints.
            </p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0a0e17] text-slate-400 border-b border-slate-800">
                <th className="py-3.5 px-4 font-semibold">User Identity</th>
                <th className="py-3.5 px-4 font-semibold">Role & Status</th>
                <th className="py-3.5 px-4 font-semibold">KYC Verification</th>
                <th className="py-3.5 px-4 font-semibold text-right">Wallet Balance</th>
                <th className="py-3.5 px-4 font-semibold text-right">Active Invested</th>
                <th className="py-3.5 px-4 font-semibold text-center">Risk Score</th>
                <th className="py-3.5 px-4 font-semibold text-right">Administrative Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredUsers.map((u) => {
                const isBanned = Boolean(u.isFrozen);
                const isKycFlagged = u.kycStatus === 'REQUIRED';
                const isKycApproved = u.kycStatus === 'APPROVED';
                const isKycSubmitted = u.kycStatus === 'SUBMITTED';

                return (
                  <tr 
                    key={u.id}
                    className={`hover:bg-[#111726]/60 transition-colors ${
                      isBanned ? 'bg-rose-950/15' : ''
                    }`}
                  >
                    {/* User Identity */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          u.role === 'admin' 
                            ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40'
                            : u.role === 'support'
                            ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                            : 'bg-slate-800 text-slate-200 border border-slate-700'
                        }`}>
                          {u.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>{u.name}</span>
                            {u.referralCode && (
                              <span className="font-mono text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.2 rounded border border-slate-700/50">
                                {u.referralCode}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-500" />
                              {u.email}
                            </span>
                            {u.phone && (
                              <span className="flex items-center gap-1 font-mono text-slate-400">
                                • <Phone className="w-3 h-3 text-slate-500" />
                                {u.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role & Status */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          u.role === 'admin'
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                            : u.role === 'support'
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {u.role || 'USER'}
                        </span>
                        <div>
                          {isBanned ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Frozen / Banned</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>Active</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* KYC Verification Status */}
                    <td className="py-3.5 px-4">
                      {isKycApproved ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          <span>Verified</span>
                        </span>
                      ) : isKycSubmitted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                          <AlertTriangle className="w-3 h-3 text-blue-400" />
                          <span>Submitted (In Review)</span>
                        </span>
                      ) : isKycFlagged ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          <ShieldAlert className="w-3 h-3 text-amber-400" />
                          <span>Flagged (Required)</span>
                        </span>
                      ) : u.kycStatus === 'REJECTED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          <XCircle className="w-3 h-3 text-rose-400" />
                          <span>Rejected</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          <span>Not Required</span>
                        </span>
                      )}
                    </td>

                    {/* Wallet Balance */}
                    <td className="py-3.5 px-4 text-right font-mono">
                      <div className="font-bold text-white text-sm">
                        KES {(u.walletBalanceKES || 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        ≈ ${((u.walletBalanceKES || 0) / 130).toFixed(2)} USDT
                      </div>
                    </td>

                    {/* Active Invested */}
                    <td className="py-3.5 px-4 text-right font-mono">
                      <div className="font-bold text-emerald-400 text-sm">
                        KES {(u.investedCapitalKES || 0).toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Earnings: KES {(u.totalEarningsAccruedKES || 0).toLocaleString()}
                      </div>
                    </td>

                    {/* Risk Score */}
                    <td className="py-3.5 px-4 text-center font-mono">
                      <div className="inline-flex flex-col items-center">
                        <span className={`text-xs font-bold ${
                          (u.riskScore || 0) > 60 
                            ? 'text-rose-400' 
                            : (u.riskScore || 0) > 30 
                            ? 'text-amber-400' 
                            : 'text-emerald-400'
                        }`}>
                          {u.riskScore || 0}/100
                        </span>
                        <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                          <div 
                            className={`h-full rounded-full ${
                              (u.riskScore || 0) > 60 
                                ? 'bg-rose-500' 
                                : (u.riskScore || 0) > 30 
                                ? 'bg-amber-500' 
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, u.riskScore || 0)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Administrative Controls */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Adjust Balance */}
                        <button
                          onClick={() => {
                            setAdjustBalanceUser(u);
                            setAdjustAmount('');
                            setAdjustAction('add');
                            setAdjustType('wallet');
                            setAdjustReason('Admin deposit credit');
                          }}
                          className="px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                          title="Add or Lower User Balance"
                        >
                          <DollarSign className="w-3 h-3" />
                          <span>Balance</span>
                        </button>

                        {/* Ban / Unban Toggle */}
                        <button
                          onClick={() => handleToggleBan(u)}
                          className={`px-2.5 py-1.5 border rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                            isBanned
                              ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                              : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/30'
                          }`}
                          title={isBanned ? 'Unban & Unlock Account' : 'Ban & Freeze Account'}
                        >
                          {isBanned ? (
                            <>
                              <Unlock className="w-3 h-3" />
                              <span>Unban</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" />
                              <span>Ban</span>
                            </>
                          )}
                        </button>

                        {/* Flag KYC */}
                        <button
                          onClick={() => {
                            setKycModalUser(u);
                            setSelectedKycStatus(isKycFlagged ? 'APPROVED' : 'REQUIRED');
                            setKycReason(isKycFlagged ? 'Identity documents verified by compliance' : 'High volume activity identity verification');
                          }}
                          className={`px-2.5 py-1.5 border rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                            isKycFlagged
                              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          }`}
                          title="Flag or Update KYC Requirement"
                        >
                          <ShieldAlert className="w-3 h-3" />
                          <span>KYC</span>
                        </button>

                        {/* Wipe Controls */}
                        <button
                          onClick={() => {
                            setWipeModalUser(u);
                            setWipeActionType('violation_assets');
                            setWipeReason('Terms of Service Violation: Fake deposits and fraudulent activity');
                          }}
                          className="px-2.5 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                          title="Wipe User Data / Assets for Terms Violation"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                          <span>Wipe</span>
                        </button>

                        {/* Set Password */}
                        <button
                          onClick={() => {
                            setResetPassModalUser(u);
                            setNewPassInput('');
                          }}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition cursor-pointer"
                          title="Set / Reset User Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>

                        {/* View Details */}
                        <button
                          onClick={() => openUserDetails(u)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition cursor-pointer"
                          title="View Full User Ledger & Profile"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: BALANCE ADJUSTMENT (Add or Lower / Deduct Funds)   */}
      {/* ========================================================= */}
      <AnimatePresence>
        {adjustBalanceUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0e1422] border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    <span>Adjust User Balance</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Manage funds for <strong className="text-white">{adjustBalanceUser.name}</strong> ({adjustBalanceUser.email})
                  </p>
                </div>
                <button
                  onClick={() => setAdjustBalanceUser(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Action Selector: Add vs Deduct */}
              <div className="grid grid-cols-2 gap-2 bg-[#080d17] p-1.5 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setAdjustAction('add');
                    setAdjustReason('Admin deposit credit');
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    adjustAction === 'add'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Funds (Credit)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdjustAction('deduct');
                    setAdjustReason('Administrative adjustment / debit');
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    adjustAction === 'deduct'
                      ? 'bg-rose-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Minus className="w-3.5 h-3.5" />
                  <span>Lower / Deduct (Debit)</span>
                </button>
              </div>

              {/* Balance Target Selector: Wallet vs Invested Capital */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Balance Bucket Target</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('wallet')}
                    className={`p-3 rounded-xl border text-left transition ${
                      adjustType === 'wallet'
                        ? 'bg-purple-950/40 border-purple-500/60 text-white'
                        : 'bg-[#080d17] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">Liquid Wallet</div>
                    <div className="text-[11px] font-mono text-purple-300 mt-0.5">
                      Current: KES {adjustBalanceUser.walletBalanceKES.toLocaleString()}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustType('invested')}
                    className={`p-3 rounded-xl border text-left transition ${
                      adjustType === 'invested'
                        ? 'bg-purple-950/40 border-purple-500/60 text-white'
                        : 'bg-[#080d17] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">Invested Capital</div>
                    <div className="text-[11px] font-mono text-emerald-400 mt-0.5">
                      Current: KES {adjustBalanceUser.investedCapitalKES.toLocaleString()}
                    </div>
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Amount (KES)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                    KES
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Enter KES amount..."
                    className="w-full bg-[#080d17] border border-slate-700 rounded-xl pl-14 pr-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[500, 1000, 2500, 5000, 10000, 25000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAdjustAmount(preset)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-mono transition"
                    >
                      +{preset.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview Math */}
              {adjustAmount !== '' && Number(adjustAmount) > 0 && (
                <div className="p-3 bg-[#080d17] border border-slate-800 rounded-xl space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Starting {adjustType} Balance:</span>
                    <span className="font-mono text-slate-300">
                      KES {(adjustType === 'wallet' ? adjustBalanceUser.walletBalanceKES : adjustBalanceUser.investedCapitalKES).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Adjustment ({adjustAction.toUpperCase()}):</span>
                    <span className={`font-mono font-bold ${adjustAction === 'add' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {adjustAction === 'add' ? '+' : '-'} KES {Number(adjustAmount).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold pt-1 border-t border-slate-800 text-white">
                    <span>New Balance:</span>
                    <span className="font-mono text-purple-300">
                      KES {Math.max(
                        0,
                        (adjustType === 'wallet' ? adjustBalanceUser.walletBalanceKES : adjustBalanceUser.investedCapitalKES) +
                        (adjustAction === 'add' ? Number(adjustAmount) : -Number(adjustAmount))
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Reason / Audit Trail */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Audit Reason / Note</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Manual bank deposit, bonus yield, refund correction"
                  className="w-full bg-[#080d17] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustBalanceUser(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingAdjust || !adjustAmount || Number(adjustAmount) <= 0}
                  onClick={handleBalanceAdjustment}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    adjustAction === 'add'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-rose-500 hover:bg-rose-400 text-white'
                  } disabled:opacity-50`}
                >
                  {isSubmittingAdjust ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Confirm {adjustAction === 'add' ? 'Credit' : 'Debit'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 2: BAN / FREEZE ACCOUNT KILL SWITCH                 */}
      {/* ========================================================= */}
      <AnimatePresence>
        {banModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0e1422] border border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-400">
                <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/30">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Ban / Freeze User Account</h3>
                  <div className="text-xs text-rose-300">Kill Switch Lockout</div>
                </div>
              </div>

              <div className="p-3 bg-[#080d17] border border-slate-800 rounded-xl space-y-1 text-xs text-slate-300">
                <div>User: <strong className="text-white">{banModalUser.name}</strong></div>
                <div>Email: <span className="font-mono text-slate-400">{banModalUser.email}</span></div>
                <div>Wallet Balance: <span className="font-mono text-emerald-400">KES {banModalUser.walletBalanceKES.toLocaleString()}</span></div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Freezing this account will immediately disable all withdrawals, contract purchases, and referral payouts. An anti-fraud event will be permanently logged.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Reason for Ban</label>
                <input
                  type="text"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="e.g. Sybil multi-accounting, suspicious velocity, policy violation"
                  className="w-full bg-[#080d17] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBanModalUser(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingBan}
                  onClick={confirmBan}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingBan ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span>Engage Kill Switch</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 3: KYC FLAGGING & STATUS MANAGEMENT                */}
      {/* ========================================================= */}
      <AnimatePresence>
        {kycModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0e1422] border border-amber-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-amber-400">
                <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/30">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">KYC Compliance Status</h3>
                  <div className="text-xs text-amber-300">Investor Identity Governance</div>
                </div>
              </div>

              <div className="p-3 bg-[#080d17] border border-slate-800 rounded-xl space-y-1 text-xs text-slate-300">
                <div>User: <strong className="text-white">{kycModalUser.name}</strong></div>
                <div>Current Standing: <span className="font-mono text-purple-300">{kycModalUser.kycStatus || 'NOT_REQUIRED'}</span></div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Set New KYC Standing</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedKycStatus('REQUIRED')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
                      selectedKycStatus === 'REQUIRED'
                        ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                        : 'bg-[#080d17] border-slate-800 text-slate-400'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Flag (Require KYC)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedKycStatus('APPROVED')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
                      selectedKycStatus === 'APPROVED'
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                        : 'bg-[#080d17] border-slate-800 text-slate-400'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Approve Verified</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedKycStatus('NOT_REQUIRED')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
                      selectedKycStatus === 'NOT_REQUIRED'
                        ? 'bg-purple-500/20 border-purple-500/60 text-purple-300'
                        : 'bg-[#080d17] border-slate-800 text-slate-400'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Clear (Not Required)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedKycStatus('REJECTED')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
                      selectedKycStatus === 'REJECTED'
                        ? 'bg-rose-500/20 border-rose-500/60 text-rose-300'
                        : 'bg-[#080d17] border-slate-800 text-slate-400'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject Submission</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Compliance Reason</label>
                <input
                  type="text"
                  value={kycReason}
                  onChange={(e) => setKycReason(e.target.value)}
                  placeholder="Reason for changing KYC flag"
                  className="w-full bg-[#080d17] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setKycModalUser(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingKyc}
                  onClick={confirmKycFlag}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingKyc ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>Apply KYC Update</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 4: FULL USER DETAIL VIEW (Ledger & Contracts)       */}
      {/* ========================================================= */}
      <AnimatePresence>
        {selectedUserForDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0e1422] border border-slate-700 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center font-bold text-lg text-purple-300">
                    {selectedUserForDetail.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg flex items-center gap-2">
                      <span>{selectedUserForDetail.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                        {selectedUserForDetail.role?.toUpperCase() || 'USER'}
                      </span>
                    </h3>
                    <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
                      <span>ID: {selectedUserForDetail.id}</span>
                      <button
                        onClick={() => handleCopy(selectedUserForDetail.id, 'user-id')}
                        className="p-1 hover:text-white"
                      >
                        {copiedId === 'user-id' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedUserForDetail(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Financial Snapshot */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-[#080d17] border border-slate-800 rounded-xl p-3">
                  <div className="text-[10px] text-slate-400">Wallet Balance</div>
                  <div className="text-base font-bold text-white font-mono mt-0.5">
                    KES {(selectedUserForDetail.walletBalanceKES || 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-[#080d17] border border-slate-800 rounded-xl p-3">
                  <div className="text-[10px] text-slate-400">Active Invested</div>
                  <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                    KES {(selectedUserForDetail.investedCapitalKES || 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-[#080d17] border border-slate-800 rounded-xl p-3">
                  <div className="text-[10px] text-slate-400">Accrued Yield</div>
                  <div className="text-base font-bold text-purple-400 font-mono mt-0.5">
                    KES {(selectedUserForDetail.totalEarningsAccruedKES || 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-[#080d17] border border-slate-800 rounded-xl p-3">
                  <div className="text-[10px] text-slate-400">Total Withdrawn</div>
                  <div className="text-base font-bold text-cyan-400 font-mono mt-0.5">
                    KES {(selectedUserForDetail.totalWithdrawnKES || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* User Metadata */}
              <div className="bg-[#080d17] border border-slate-800 rounded-xl p-4 text-xs space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                  <div><strong>Email:</strong> {selectedUserForDetail.email}</div>
                  <div><strong>Phone:</strong> {selectedUserForDetail.phone || 'None'}</div>
                  <div><strong>Referral Code:</strong> {selectedUserForDetail.referralCode || 'None'}</div>
                  <div><strong>Referred By:</strong> {selectedUserForDetail.referredByCode || 'None (Organic)'}</div>
                  <div><strong>Risk Score:</strong> {selectedUserForDetail.riskScore || 0}/100</div>
                  <div><strong>Account Status:</strong> {selectedUserForDetail.isFrozen ? `Frozen (${selectedUserForDetail.freezeReason || 'Compliance'})` : 'Active Standing'}</div>
                </div>
              </div>

              {/* Active Contracts & History */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  <span>Active Contracts ({userDetailInvestments.length})</span>
                </h4>

                {isLoadingDetails ? (
                  <div className="py-6 text-center text-slate-500 text-xs">Loading contracts...</div>
                ) : userDetailInvestments.length === 0 ? (
                  <div className="p-3 text-center bg-[#080d17] border border-slate-800 rounded-xl text-slate-500 text-xs">
                    No active packages under contract.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {userDetailInvestments.map((inv) => (
                      <div key={inv.id} className="p-2.5 bg-[#080d17] border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-white">{inv.packageName}</div>
                          <div className="text-[10px] text-slate-400">Day {inv.daysElapsed} of {inv.durationDays} • {inv.dailyRoiPercent}% ROI</div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="font-bold text-emerald-400">KES {inv.amountKES.toLocaleString()}</div>
                          <div className="text-[10px] text-slate-400">Yield: KES {inv.totalEarnedKES.toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Actions Footer */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => {
                    setAdjustBalanceUser(selectedUserForDetail);
                    setAdjustAmount('');
                    setAdjustAction('add');
                    setAdjustType('wallet');
                  }}
                  className="flex-1 min-w-[110px] py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Adjust Balance
                </button>
                <button
                  onClick={() => handleToggleBan(selectedUserForDetail)}
                  className="flex-1 min-w-[110px] py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  {selectedUserForDetail.isFrozen ? 'Unban Account' : 'Freeze Account'}
                </button>
                <button
                  onClick={() => {
                    setKycModalUser(selectedUserForDetail);
                    setSelectedKycStatus(selectedUserForDetail.kycStatus === 'REQUIRED' ? 'APPROVED' : 'REQUIRED');
                  }}
                  className="flex-1 min-w-[110px] py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Update KYC
                </button>
                <button
                  onClick={() => {
                    setWipeModalUser(selectedUserForDetail);
                    setWipeActionType('violation_assets');
                    setWipeReason('Terms of Service Violation: Fake deposits & unauthorized exploit');
                  }}
                  className="flex-1 min-w-[110px] py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>Wipe Controls</span>
                </button>
                <button
                  onClick={() => {
                    setResetPassModalUser(selectedUserForDetail);
                    setNewPassInput('');
                  }}
                  className="flex-1 min-w-[110px] py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1"
                >
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  <span>Set Password</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 5: WIPE CONTROLS & TERMS VIOLATION LIQUIDATION      */}
      {/* ========================================================= */}
      <AnimatePresence>
        {wipeModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0e1422] border border-red-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-red-400">
                <div className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/30">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">User Wipe & Enforcement</h3>
                  <div className="text-xs text-red-300">Clean Logs & Liquidate Violated Accounts</div>
                </div>
              </div>

              <div className="p-3 bg-[#080d17] border border-slate-800 rounded-xl space-y-1 text-xs text-slate-300">
                <div>Target User: <strong className="text-white">{wipeModalUser.name}</strong> ({wipeModalUser.phone || wipeModalUser.email})</div>
                <div className="flex justify-between font-mono pt-1 text-[11px]">
                  <span>Wallet: <strong className="text-emerald-400">KES {(wipeModalUser.walletBalanceKES || 0).toLocaleString()}</strong></span>
                  <span>Invested: <strong className="text-purple-400">KES {(wipeModalUser.investedCapitalKES || 0).toLocaleString()}</strong></span>
                </div>
              </div>

              {/* Action Type Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Select Wipe Action</label>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() => {
                      setWipeActionType('violation_assets');
                      setWipeReason('Terms of Service Violation: Fake deposits & unauthorized exploit');
                    }}
                    className={`w-full p-2.5 rounded-xl border text-left text-xs transition cursor-pointer flex items-start gap-2.5 ${
                      wipeActionType === 'violation_assets'
                        ? 'bg-red-500/20 border-red-500/60 text-red-200'
                        : 'bg-[#080d17] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Flame className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-white">Violations Wipe (Forfeit All Capital & Freeze)</div>
                      <div className="text-[11px] text-slate-400">Liquidates packages to 0, sets wallet & earnings to 0, and freezes account.</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWipeActionType('failed_tx');
                      setWipeReason('Clean up failed/rejected deposit attempts');
                    }}
                    className={`w-full p-2.5 rounded-xl border text-left text-xs transition cursor-pointer flex items-start gap-2.5 ${
                      wipeActionType === 'failed_tx'
                        ? 'bg-amber-500/20 border-amber-500/60 text-amber-200'
                        : 'bg-[#080d17] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Trash2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-white">Wipe Failed / Cancelled Deposits</div>
                      <div className="text-[11px] text-slate-400">Removes uncompleted deposits, rejected withdrawals, and failed attempts.</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWipeActionType('all_tx');
                      setWipeReason('Administrative purge of user transaction history');
                    }}
                    className={`w-full p-2.5 rounded-xl border text-left text-xs transition cursor-pointer flex items-start gap-2.5 ${
                      wipeActionType === 'all_tx'
                        ? 'bg-purple-500/20 border-purple-500/60 text-purple-200'
                        : 'bg-[#080d17] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-white">Wipe All Transactions</div>
                      <div className="text-[11px] text-slate-400">Clears entire ledger transaction history for this user.</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWipeActionType('user_logs');
                      setWipeReason('Purge user activity logs and security alerts');
                    }}
                    className={`w-full p-2.5 rounded-xl border text-left text-xs transition cursor-pointer flex items-start gap-2.5 ${
                      wipeActionType === 'user_logs'
                        ? 'bg-blue-500/20 border-blue-500/60 text-blue-200'
                        : 'bg-[#080d17] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-white">Wipe User Activity & Chat Logs</div>
                      <div className="text-[11px] text-slate-400">Clears support chat messages, threads, and anti-fraud alerts.</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWipeActionType('clean_slate');
                      setWipeReason('Clean slate account reset by administrator');
                    }}
                    className={`w-full p-2.5 rounded-xl border text-left text-xs transition cursor-pointer flex items-start gap-2.5 ${
                      wipeActionType === 'clean_slate'
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200'
                        : 'bg-[#080d17] border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <RefreshCw className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-white">Complete Clean Slate Reset</div>
                      <div className="text-[11px] text-slate-400">Zeros all balances, purges all contracts & logs, unfreezes account to fresh clean state.</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Reason Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Audit Reason / Justification</label>
                <input
                  type="text"
                  value={wipeReason}
                  onChange={(e) => setWipeReason(e.target.value)}
                  placeholder="e.g. Terms of Service Violation: Fake deposits & unauthorized exploit"
                  className="w-full bg-[#080d17] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setWipeModalUser(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmWipeAction}
                  disabled={isSubmittingWipe}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-red-600/30"
                >
                  {isSubmittingWipe ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>Confirm Wipe</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* MODAL 6: DIRECT USER PASSWORD RESET / CREDENTIALS        */}
      {/* ========================================================= */}
      <AnimatePresence>
        {resetPassModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0e1422] border border-purple-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-purple-400">
                <div className="p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/30">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Set User Password</h3>
                  <div className="text-xs text-purple-300">Direct Administrative Credential Override</div>
                </div>
              </div>

              <div className="p-3 bg-[#080d17] border border-slate-800 rounded-xl space-y-1 text-xs text-slate-300">
                <div>User: <strong className="text-white">{resetPassModalUser.name}</strong></div>
                <div>Email / Phone: <span className="text-purple-300 font-mono">{resetPassModalUser.email || resetPassModalUser.phone}</span></div>
                <div>Current Standing: <span className="font-mono text-emerald-400">{resetPassModalUser.isFrozen ? 'Frozen / Suspended' : 'Active Standing'}</span></div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">New Password</label>
                <input
                  type="text"
                  value={newPassInput}
                  onChange={(e) => setNewPassInput(e.target.value)}
                  placeholder="Enter new password (min 4 characters)"
                  className="w-full bg-[#080d17] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                />
                
                {/* Quick Presets */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setNewPassInput('123456')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded-lg border border-slate-700 cursor-pointer"
                  >
                    Preset: 123456
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPassInput('RoyalPass2026!')}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded-lg border border-slate-700 cursor-pointer"
                  >
                    Preset: RoyalPass2026!
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setResetPassModalUser(null); setNewPassInput(''); }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmPasswordReset}
                  disabled={isSubmittingPass || !newPassInput.trim()}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/30"
                >
                  {isSubmittingPass ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Save Password</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
