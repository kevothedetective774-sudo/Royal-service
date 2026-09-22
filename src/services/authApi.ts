import { UserProfile } from '../types';
import { apiUrl, parseJsonResponse } from '../utils/apiBase';

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
    const res = await fetch(apiUrl('/api/neon/status'));
    if (!res.ok) throw new Error('Failed to fetch Neon status');
    const data = await parseJsonResponse(res);
    return {
      connected: data.connected,
      database: data.database,
      status: data.status,
      projectId: data.database,
      counts: data.tables || {},
    };
  },

  login: async (creds: { identifier: string; password: string }): Promise<{ success: boolean; user: UserProfile }> => {
    const res = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds),
    });
    if (!res.ok) {
      const err = await parseJsonResponse(res).catch(() => ({}));
      throw new Error(err.error || 'Failed to login');
    }
    return parseJsonResponse(res);
  },

  register: async (params: {
    name: string;
    email: string;
    phone: string;
    password: string;
    referredByCode?: string;
  }): Promise<{ success: boolean; user: UserProfile }> => {
    const res = await fetch(apiUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await parseJsonResponse(res).catch(() => ({}));
      throw new Error(err.error || 'Failed to register');
    }
    return parseJsonResponse(res);
  },

  getAllUsers: async (): Promise<UserProfile[]> => {
    const res = await fetch(apiUrl('/api/admin/users'));
    if (res.ok) {
      const data = await parseJsonResponse(res);
      return data.users || [];
    }
    const fallbackRes = await fetch(apiUrl('/api/auth/users'));
    if (!fallbackRes.ok) throw new Error('Failed to fetch users');
    const data = await parseJsonResponse(fallbackRes);
    return data.users || [];
  },

  adjustBalance: async (params: {
    userId: string;
    amountKES: number;
    action: 'add' | 'deduct';
    type?: 'wallet' | 'invested';
    reason?: string;
  }): Promise<{ success: boolean; user: UserProfile; message: string }> => {
    const res = await fetch(apiUrl(`/api/admin/users/${params.userId}/adjust-balance`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await parseJsonResponse(res).catch(() => ({}));
      throw new Error(err.error || 'Failed to adjust balance');
    }
    return parseJsonResponse(res);
  },

  banUser: async (userId: string, reason?: string): Promise<{ success: boolean; user: UserProfile; message: string }> => {
    const res = await fetch(apiUrl(`/api/admin/users/${userId}/ban`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || 'Account banned by administrator' }),
    });
    if (!res.ok) {
      const err = await parseJsonResponse(res).catch(() => ({}));
      throw new Error(err.error || 'Failed to ban user');
    }
    return parseJsonResponse(res);
  },

  unbanUser: async (userId: string): Promise<{ success: boolean; user: UserProfile; message: string }> => {
    const res = await fetch(apiUrl(`/api/admin/users/${userId}/unban`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await parseJsonResponse(res).catch(() => ({}));
      throw new Error(err.error || 'Failed to unban user');
    }
    return parseJsonResponse(res);
  },

  flagKyc: async (params: {
    userId: string;
    status: 'REQUIRED' | 'NOT_REQUIRED' | 'APPROVED' | 'REJECTED' | 'PENDING';
    reason?: string;
    riskScore?: number;
    unfreeze?: boolean;
  }): Promise<{ success: boolean; user: UserProfile; message: string }> => {
    const res = await fetch(apiUrl(`/api/admin/users/${params.userId}/kyc-flag`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await parseJsonResponse(res).catch(() => ({}));
      throw new Error(err.error || 'Failed to update KYC status');
    }
    return parseJsonResponse(res);
  },

  violationWipe: async (userId: string, reason: string): Promise<{ success: boolean; user: UserProfile; message: string }> => {
    const res = await fetch(apiUrl(`/api/admin/users/${userId}/violation-wipe`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await parseJsonResponse(res).catch(() => ({}));
      throw new Error(err.error || 'Failed to execute terms violation wipe');
    }
    return parseJsonResponse(res);
  },

  wipeFailedTransactions: async (userId?: string): Promise<{ success: boolean; deletedCount: number; message: string }> => {
    const url = userId ? `/api/admin/users/${userId}/wipe-failed-transactions` : `/api/admin/wipe/failed-deposits`;
    const res = await fetch(apiUrl(url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await parseJsonResponse(res).catch(() => ({}));
      throw new Error(err.error || 'Failed to wipe transactions');
    }
    return parseJsonResponse(res);
  },

  wipeAllUserTransactions: async (userId: string): Promise<{ success: boolean; deletedCount: number; message: string }> => {
    const res = await fetch(apiUrl(`/api/admin/users/${userId}/wipe-all-transactions`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await parseJsonResponse(res).catch(() => ({}));
      throw new Error(err.error || 'Failed to wipe user transactions');
    }
    return parseJsonResponse(res);
  },

  resetUserAccount: async (userId: string, reason?: string): Promise<{ success: boolean; user: UserProfile; message: string }> => {
    const res = await fetch(apiUrl(`/api/admin/users/${userId}/reset-account`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await parseJsonResponse(res).catch(() => ({}));
      throw new Error(err.error || 'Failed to reset user account');
    }
    return parseJsonResponse(res);
  },

  wipeUserLogs: async (userId: string): Promise<{ success: boolean; cleared: string[]; message: string }> => {
    const res = await fetch(apiUrl(`/api/admin/users/${userId}/wipe-logs`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await parseJsonResponse(res).catch(() => ({}));
      throw new Error(err.error || 'Failed to wipe user logs');
    }
    return parseJsonResponse(res);
  },

  resetUserPassword: async (userId: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(apiUrl(`/api/admin/users/${userId}/reset-password`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword }),
    });
    if (!res.ok) {
      const err = await parseJsonResponse(res).catch(() => ({}));
      throw new Error(err.error || 'Failed to reset password');
    }
    return parseJsonResponse(res);
  },

  wipeAntiFraudLogs: async (): Promise<{ success: boolean; deletedCount: number; message: string }> => {
    const res = await fetch(apiUrl('/api/admin/wipe/antifraud-logs'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await parseJsonResponse(res).catch(() => ({}));
      throw new Error(err.error || 'Failed to wipe security logs');
    }
    return parseJsonResponse(res);
  },

  wipeAllTestData: async (): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(apiUrl('/api/admin/wipe/all-test-data'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await parseJsonResponse(res).catch(() => ({}));
      throw new Error(err.error || 'Failed to purge test data');
    }
    return parseJsonResponse(res);
  },
};
