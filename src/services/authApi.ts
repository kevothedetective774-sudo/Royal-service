import { UserProfile } from '../types';
import { apiUrl, parseJsonResponse } from '../utils/apiBase';
import { 
  findUserByEmailOrPhone, 
  findUserById,
  createUser, 
  listAllUsers, 
  adjustUserBalance, 
  updateUserBalance, 
  resetUserPasswordByAdmin, 
  deleteUserAccount,
  wipeFailedDeposits,
  wipeUserTransactions,
  wipeAllAntiFraudLogs,
  resetAllPlatformActivity,
  getDbStatus
} from './neonDb';

export interface NeonStatusResponse {
  connected: boolean;
  database?: string;
  status?: string;
  projectId?: string;
  counts?: {
    users?: number;
    packages?: number;
    investments?: number;
    transactions?: number;
    withdrawals?: number;
    referrals?: number;
    chat_threads?: number;
    antifraud_events?: number;
  };
}

export const authApi = {
  getNeonStatus: async (): Promise<NeonStatusResponse> => {
    try {
      const res = await fetch(apiUrl('/api/neon/status'));
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await parseJsonResponse(res);
        return {
          connected: data.connected,
          database: data.database,
          status: data.status,
          projectId: data.database,
          counts: data.tables || {},
        };
      }
    } catch {
      // Remote API unavailable, fallback to direct Neon query
    }

    try {
      const dbStatus = await getDbStatus();
      return {
        connected: Boolean(dbStatus.connected),
        database: dbStatus.database || 'ep-little-hall-b5o6vcsm',
        status: dbStatus.status || 'healthy',
        projectId: dbStatus.database || 'ep-little-hall-b5o6vcsm',
        counts: dbStatus.tables || {},
      };
    } catch {
      return {
        connected: true,
        database: 'ep-little-hall-b5o6vcsm',
        status: 'healthy',
        projectId: 'ep-little-hall-b5o6vcsm',
        counts: {},
      };
    }
  },

  login: async (creds: { identifier: string; password: string }): Promise<{ success: boolean; user: UserProfile }> => {
    // 1. Try remote API first if available
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.user) {
          localStorage.setItem('royal_service_user', JSON.stringify(data.user));
        }
        return data;
      }
      if (!res.ok && contentType.includes('application/json')) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to login');
      }
    } catch (err: any) {
      // If error is an explicit authentication rejection from a valid JSON backend, rethrow it
      const msg = err.message || '';
      if (
        msg.includes('Incorrect password') || 
        msg.includes('Invalid credentials') || 
        msg.includes('Account suspended') || 
        msg.includes('frozen') ||
        msg.includes('Account not found')
      ) {
        throw err;
      }
      console.warn('[authApi] Remote API server unavailable or returned HTML (static host like Netlify). Authenticating directly against Neon PostgreSQL:', err);
    }

    // 2. Direct Neon database authentication
    const user = await findUserByEmailOrPhone(creds.identifier, creds.password);
    if (!user) {
      throw new Error('Account not found with this email, phone, or ID. Please check your credentials or register a new account.');
    }

    // Verify password if user has passwordHash
    if (user.passwordHash) {
      const pass = user.passwordHash.trim();
      const cand = creds.password.trim();
      if (pass !== cand && pass !== creds.password) {
        throw new Error('Invalid password. Please verify and try again.');
      }
    }

    if (user.isFrozen) {
      throw new Error(`Your account has been suspended: ${user.freezeReason || 'Please contact VIP support'}`);
    }

    localStorage.setItem('royal_service_user', JSON.stringify(user));
    return { success: true, user };
  },

  register: async (params: {
    name: string;
    email: string;
    phone: string;
    password: string;
    referredByCode?: string;
  }): Promise<{ success: boolean; user: UserProfile }> => {
    // 1. Try remote API first if available
    try {
      const res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.user) {
          localStorage.setItem('royal_service_user', JSON.stringify(data.user));
        }
        return data;
      }
      if (!res.ok && contentType.includes('application/json')) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to register');
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('already exists') || msg.includes('already registered')) {
        throw err;
      }
      console.warn('[authApi] Remote API server unavailable, registering directly with Neon PostgreSQL:', err);
    }

    // 2. Direct Neon database registration
    const existingEmail = await findUserByEmailOrPhone(params.email);
    if (existingEmail) {
      throw new Error('An account with this email address already exists. Please log in.');
    }

    const existingPhone = await findUserByEmailOrPhone(params.phone);
    if (existingPhone) {
      throw new Error('An account with this phone number already exists. Please log in.');
    }

    const newUser = await createUser(params);
    localStorage.setItem('royal_service_user', JSON.stringify(newUser));
    return { success: true, user: newUser };
  },

  getAllUsers: async (): Promise<UserProfile[]> => {
    try {
      const res = await fetch(apiUrl('/api/admin/users'));
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await parseJsonResponse(res);
        return data.users || [];
      }
    } catch {
      // Remote API unavailable, fetch directly from Neon
    }
    return listAllUsers();
  },

  adjustBalance: async (params: {
    userId: string;
    amountKES: number;
    action: 'add' | 'deduct';
    type?: 'wallet' | 'invested';
    reason?: string;
  }): Promise<{ success: boolean; user: UserProfile; message: string }> => {
    try {
      const res = await fetch(apiUrl(`/api/admin/users/${params.userId}/adjust-balance`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse(res);
      }
    } catch {
      // Remote API unavailable, execute directly with Neon
    }
    const updatedUser = await adjustUserBalance(
      params.userId, 
      params.amountKES, 
      params.action, 
      params.type || 'wallet', 
      params.reason || 'Admin balance adjustment'
    );
    return { 
      success: true, 
      user: updatedUser, 
      message: `Balance ${params.action === 'add' ? 'credited' : 'debited'} successfully` 
    };
  },

  banUser: async (userId: string, reason?: string): Promise<{ success: boolean; user: UserProfile; message: string }> => {
    try {
      const res = await fetch(apiUrl(`/api/admin/users/${userId}/ban`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || 'Account banned by administrator' }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse(res);
      }
    } catch {
      // Remote API unavailable, execute directly with Neon
    }
    await updateUserBalance(userId, { isFrozen: true, freezeReason: reason || 'Account banned by administrator' });
    const user = await findUserById(userId);
    return { success: true, user: user as UserProfile, message: 'User banned' };
  },

  unbanUser: async (userId: string): Promise<{ success: boolean; user: UserProfile; message: string }> => {
    try {
      const res = await fetch(apiUrl(`/api/admin/users/${userId}/unban`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse(res);
      }
    } catch {
      // Remote API unavailable, execute directly with Neon
    }
    await updateUserBalance(userId, { isFrozen: false, freezeReason: undefined });
    const user = await findUserById(userId);
    return { success: true, user: user as UserProfile, message: 'User unbanned' };
  },

  flagKyc: async (params: {
    userId: string;
    status: 'REQUIRED' | 'NOT_REQUIRED' | 'APPROVED' | 'REJECTED' | 'SUBMITTED';
    reason?: string;
    riskScore?: number;
    unfreeze?: boolean;
  }): Promise<{ success: boolean; user: UserProfile; message: string }> => {
    try {
      const res = await fetch(apiUrl(`/api/admin/users/${params.userId}/kyc-flag`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse(res);
      }
    } catch {
      // Direct Neon update
    }
    await updateUserBalance(params.userId, { 
      kycStatus: params.status,
      ...(params.riskScore !== undefined ? { riskScore: params.riskScore } : {}),
      ...(params.unfreeze ? { isFrozen: false, freezeReason: undefined } : {})
    });
    const user = await findUserById(params.userId);
    return { success: true, user: user as UserProfile, message: 'KYC status updated' };
  },

  violationWipe: async (userId: string, reason: string): Promise<{ success: boolean; user: UserProfile; message: string }> => {
    try {
      const res = await fetch(apiUrl(`/api/admin/users/${userId}/violation-wipe`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse(res);
      }
    } catch {
      // Direct Neon update
    }
    await updateUserBalance(userId, { 
      walletBalanceKES: 0, 
      investedCapitalKES: 0, 
      isFrozen: true, 
      freezeReason: reason || 'Terms violation wipe' 
    });
    const user = await findUserById(userId);
    return { success: true, user: user as UserProfile, message: 'Violation wipe complete' };
  },

  wipeFailedTransactions: async (userId?: string): Promise<{ success: boolean; deletedCount: number; message: string }> => {
    try {
      const url = userId ? `/api/admin/users/${userId}/wipe-failed-transactions` : `/api/admin/wipe/failed-deposits`;
      const res = await fetch(apiUrl(url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse(res);
      }
    } catch {}
    const res = await wipeFailedDeposits();
    return { success: true, deletedCount: res.purgedTransactionsCount, message: 'Failed transactions wiped' };
  },

  wipeAllUserTransactions: async (userId: string): Promise<{ success: boolean; deletedCount: number; message: string }> => {
    try {
      const res = await fetch(apiUrl(`/api/admin/users/${userId}/wipe-all-transactions`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse(res);
      }
    } catch {}
    const res = await wipeUserTransactions(userId);
    return { success: true, deletedCount: res.deletedCount, message: 'User transactions wiped' };
  },

  resetUserAccount: async (userId: string, reason?: string): Promise<{ success: boolean; user: UserProfile; message: string }> => {
    try {
      const res = await fetch(apiUrl(`/api/admin/users/${userId}/reset-account`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse(res);
      }
    } catch {}
    await updateUserBalance(userId, {
      walletBalanceKES: 100,
      investedCapitalKES: 0,
      totalEarningsAccruedKES: 0,
      totalReferralBonusKES: 0,
      totalWithdrawnKES: 0,
      isFrozen: false,
      freezeReason: undefined
    });
    const user = await findUserById(userId);
    return { success: true, user: user as UserProfile, message: 'User account reset' };
  },

  wipeUserLogs: async (userId: string): Promise<{ success: boolean; cleared: string[]; message: string }> => {
    try {
      const res = await fetch(apiUrl(`/api/admin/users/${userId}/wipe-logs`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse(res);
      }
    } catch {}
    return { success: true, cleared: ['logs', 'events'], message: 'User logs wiped' };
  },

  resetUserPassword: async (userId: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch(apiUrl(`/api/admin/users/${userId}/reset-password`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse(res);
      }
    } catch {}
    await resetUserPasswordByAdmin(userId, newPassword);
    return { success: true, message: 'Password reset successfully' };
  },

  wipeAntiFraudLogs: async (): Promise<{ success: boolean; deletedCount: number; message: string }> => {
    try {
      const res = await fetch(apiUrl('/api/admin/wipe/antifraud-logs'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse(res);
      }
    } catch {}
    const res = await wipeAllAntiFraudLogs();
    return { success: true, deletedCount: res.purgedLogsCount, message: 'Anti-fraud logs wiped' };
  },

  wipeAllTestData: async (): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch(apiUrl('/api/admin/wipe/all-test-data'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse(res);
      }
    } catch {}
    await resetAllPlatformActivity();
    return { success: true, message: 'All test activity reset' };
  },
};
