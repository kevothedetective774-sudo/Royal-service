import { UserProfile } from '../types';

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
    const res = await fetch('/api/neon/status');
    if (!res.ok) throw new Error('Failed to fetch Neon status');
    const data = await res.json();
    return {
      connected: data.connected,
      database: data.database,
      status: data.status,
      projectId: data.database,
      counts: data.tables || {},
    };
  },

  login: async (creds: { identifier: string; password: string }): Promise<{ success: boolean; user: UserProfile }> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to login');
    }
    return res.json();
  },

  register: async (params: {
    name: string;
    email: string;
    phone: string;
    password: string;
    referredByCode?: string;
  }): Promise<{ success: boolean; user: UserProfile }> => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to register');
    }
    return res.json();
  },

  getAllUsers: async (): Promise<UserProfile[]> => {
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      const data = await res.json();
      return data.users || [];
    }
    const fallbackRes = await fetch('/api/auth/users');
    if (!fallbackRes.ok) throw new Error('Failed to fetch users');
    const data = await fallbackRes.json();
    return data.users || [];
  },

  adjustBalance: async (params: {
    userId: string;
    amountKES: number;
    action: 'add' | 'deduct';
    type?: 'wallet' | 'invested';
    reason?: string;
  }): Promise<{ success: boolean; user: UserProfile; message: string }> => {
    const res = await fetch(`/api/admin/users/${params.userId}/adjust-balance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to adjust balance');
    }
    return res.json();
  },

  banUser: async (userId: string, reason?: string): Promise<{ success: boolean; user: UserProfile; message: string }> => {
    const res = await fetch(`/api/admin/users/${userId}/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || 'Account banned by administrator' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to ban user');
    }
    return res.json();
  },

  unbanUser: async (userId: string): Promise<{ success: boolean; user: UserProfile; message: string }> => {
    const res = await fetch(`/api/admin/users/${userId}/unban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to unban user');
    }
    return res.json();
  },

  flagKyc: async (params: {
    userId: string;
    status: 'REQUIRED' | 'NOT_REQUIRED' | 'APPROVED' | 'REJECTED' | 'PENDING';
    reason?: string;
    riskScore?: number;
    unfreeze?: boolean;
  }): Promise<{ success: boolean; user: UserProfile; message: string }> => {
    const res = await fetch(`/api/admin/users/${params.userId}/kyc-flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update KYC status');
    }
    return res.json();
  },

  violationWipe: async (userId: string, reason: string): Promise<{ success: boolean; user: UserProfile; message: string }> => {
    const res = await fetch(`/api/admin/users/${userId}/violation-wipe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to execute terms violation wipe');
    }
    return res.json();
  },

  wipeFailedTransactions: async (userId?: string): Promise<{ success: boolean; deletedCount: number; message: string }> => {
    const url = userId ? `/api/admin/users/${userId}/wipe-failed-transactions` : `/api/admin/wipe/failed-deposits`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to wipe transactions');
    }
    return res.json();
  },

  wipeAllUserTransactions: async (userId: string): Promise<{ success: boolean; deletedCount: number; message: string }> => {
    const res = await fetch(`/api/admin/users/${userId}/wipe-all-transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to wipe user transactions');
    }
    return res.json();
  },

  resetUserAccount: async (userId: string, reason?: string): Promise<{ success: boolean; user: UserProfile; message: string }> => {
    const res = await fetch(`/api/admin/users/${userId}/reset-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to reset user account');
    }
    return res.json();
  },

  wipeUserLogs: async (userId: string): Promise<{ success: boolean; cleared: string[]; message: string }> => {
    const res = await fetch(`/api/admin/users/${userId}/wipe-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to wipe user logs');
    }
    return res.json();
  },

  resetUserPassword: async (userId: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    const res = await fetch(`/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to reset password');
    }
    return res.json();
  },

  wipeAntiFraudLogs: async (): Promise<{ success: boolean; deletedCount: number; message: string }> => {
    const res = await fetch('/api/admin/wipe/antifraud-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to wipe security logs');
    }
    return res.json();
  },

  wipeAllTestData: async (): Promise<{ success: boolean; message: string }> => {
    const res = await fetch('/api/admin/wipe/all-test-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to purge test data');
    }
    return res.json();
  },
};
