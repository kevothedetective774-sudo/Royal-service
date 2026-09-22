import { 
  InvestmentPackage, 
  PlatformSettings, 
  ActiveInvestment, 
  Transaction, 
  WithdrawalRequest, 
  ReferralMember, 
  UserProfile 
} from '../types';
import { apiUrl, parseJsonResponse } from '../utils/apiBase';
import {
  getAllPackages,
  createInvestmentPackage,
  updateInvestmentPackage,
  deleteInvestmentPackage,
  resetInvestmentPackages,
  getUserInvestments,
  createInvestment,
  getUserTransactions,
  createTransaction,
  getUserWithdrawals,
  createWithdrawal,
  updateWithdrawalStatus,
  getUserReferrals,
  getPlatformSettings,
  updatePlatformSettingsInDb,
  getDbStatus,
  initNeonSchema,
  calculateUserCampaignStats,
  updateUserSalaryConfig,
  getPendingCommissions,
  getWeeklySalaryPayouts,
  releaseMaturedCommissions
} from './neonDb';

export interface NeonDbStatus {
  connected: boolean;
  database?: string;
  status?: string;
  error?: string;
  fallbackMode?: boolean;
  projectId?: string;
  isNeonConnected?: boolean;
  counts: {
    users: number;
    packages: number;
    investments: number;
    transactions: number;
    withdrawals: number;
    referrals: number;
    chatThreads?: number;
    chatMessages?: number;
    chat_threads?: number;
    antifraud_events?: number;
  };
}

export const neonApi = {
  getStatus: async (): Promise<NeonDbStatus> => {
    try {
      const res = await fetch(apiUrl('/api/neon/status'));
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await parseJsonResponse(res);
        const chatCount = data.tables?.chat_threads ?? 0;
        return {
          connected: Boolean(data.connected),
          isNeonConnected: Boolean(data.connected),
          database: data.database || 'ep-little-hall-b5o6vcsm',
          projectId: data.database || 'ep-little-hall-b5o6vcsm',
          status: data.status || 'healthy',
          counts: {
            users: data.tables?.users ?? 0,
            packages: data.tables?.packages ?? 0,
            investments: data.tables?.investments ?? 0,
            transactions: data.tables?.transactions ?? 0,
            withdrawals: data.tables?.withdrawals ?? 0,
            referrals: data.tables?.referrals ?? 0,
            chatThreads: chatCount,
            chatMessages: chatCount * 2,
            chat_threads: chatCount,
            antifraud_events: data.tables?.antifraud_events ?? 0,
          }
        };
      }
    } catch {}

    const data = await getDbStatus();
    const chatCount = data.tables?.chat_threads ?? 0;
    return {
      connected: Boolean(data.connected),
      isNeonConnected: Boolean(data.connected),
      database: data.database || 'ep-little-hall-b5o6vcsm',
      projectId: data.database || 'ep-little-hall-b5o6vcsm',
      status: data.status || 'healthy',
      counts: {
        users: data.tables?.users ?? 0,
        packages: data.tables?.packages ?? 0,
        investments: data.tables?.investments ?? 0,
        transactions: data.tables?.transactions ?? 0,
        withdrawals: data.tables?.withdrawals ?? 0,
        referrals: data.tables?.referrals ?? 0,
        chatThreads: chatCount,
        chatMessages: chatCount * 2,
        chat_threads: chatCount,
        antifraud_events: data.tables?.antifraud_events ?? 0,
      }
    };
  },
  sync: async (): Promise<{ success: boolean; status: NeonDbStatus }> => {
    try {
      const res = await fetch(apiUrl('/api/neon/sync'), { method: 'POST' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const status = await neonApi.getStatus();
        return { success: true, status };
      }
    } catch {}
    await initNeonSchema();
    const status = await neonApi.getStatus();
    return { success: true, status };
  },
};

export const packagesApi = {
  getAll: async (): Promise<InvestmentPackage[]> => {
    try {
      const res = await fetch(apiUrl('/api/packages'));
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse<InvestmentPackage[]>(res);
      }
    } catch {}
    return getAllPackages();
  },
  create: async (pkg: InvestmentPackage): Promise<InvestmentPackage> => {
    try {
      const res = await fetch(apiUrl('/api/packages'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pkg),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse<InvestmentPackage>(res);
      }
    } catch {}
    return createInvestmentPackage(pkg);
  },
  update: async (idOrPkg: string | InvestmentPackage, maybePkg?: InvestmentPackage): Promise<InvestmentPackage> => {
    const pkg = maybePkg || (idOrPkg as InvestmentPackage);
    const id = typeof idOrPkg === 'string' ? idOrPkg : pkg.id;
    try {
      const res = await fetch(apiUrl(`/api/packages/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pkg),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse<InvestmentPackage>(res);
      }
    } catch {}
    return updateInvestmentPackage(id, pkg);
  },
  delete: async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(apiUrl(`/api/packages/${id}`), { method: 'DELETE' });
      if (res.ok) return true;
    } catch {}
    return deleteInvestmentPackage(id);
  },
  reset: async (): Promise<InvestmentPackage[]> => {
    try {
      const res = await fetch(apiUrl('/api/packages/reset'), { method: 'POST' });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse<InvestmentPackage[]>(res);
      }
    } catch {}
    return resetInvestmentPackages();
  },
};

export const investmentsApi = {
  getAll: async (userId?: string): Promise<ActiveInvestment[]> => {
    try {
      const url = userId ? `/api/investments?userId=${userId}` : '/api/investments';
      const res = await fetch(apiUrl(url));
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse<ActiveInvestment[]>(res);
      }
    } catch {}
    return getUserInvestments(userId || '');
  },
  getUserInvestments: async (userId: string): Promise<ActiveInvestment[]> => {
    return investmentsApi.getAll(userId);
  },
  create: async (userId: string, investment: ActiveInvestment, userUpdates?: Partial<UserProfile>): Promise<ActiveInvestment> => {
    try {
      const res = await fetch(apiUrl('/api/investments'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, investment, userUpdates }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await parseJsonResponse(res);
        return data.investment || data;
      }
    } catch {}
    return createInvestment(userId, investment);
  },
  activate: async (params: {
    userId: string;
    investment: ActiveInvestment;
    transaction?: Transaction;
    userUpdates?: Partial<UserProfile>;
  }): Promise<ActiveInvestment> => {
    return investmentsApi.create(params.userId, params.investment, params.userUpdates);
  },
};

export const transactionsApi = {
  getAll: async (userId?: string): Promise<Transaction[]> => {
    try {
      const url = userId ? `/api/transactions?userId=${userId}` : '/api/transactions';
      const res = await fetch(apiUrl(url));
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse<Transaction[]>(res);
      }
    } catch {}
    return getUserTransactions(userId || '');
  },
  getUserTransactions: async (userId: string): Promise<Transaction[]> => {
    return transactionsApi.getAll(userId);
  },
  create: async (userId: string, transaction: Transaction, userUpdates?: Partial<UserProfile>): Promise<Transaction> => {
    try {
      const res = await fetch(apiUrl('/api/transactions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, transaction, userUpdates }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await parseJsonResponse(res);
        return data.transaction || data;
      }
    } catch {}
    return createTransaction(userId, transaction);
  },
  record: async (params: { userId: string; transaction: Transaction; userUpdates?: Partial<UserProfile> }): Promise<Transaction> => {
    return transactionsApi.create(params.userId, params.transaction, params.userUpdates);
  },
};

export const withdrawalsApi = {
  getAll: async (userId?: string): Promise<WithdrawalRequest[]> => {
    try {
      const url = userId ? `/api/withdrawals?userId=${userId}` : '/api/withdrawals';
      const res = await fetch(apiUrl(url));
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse<WithdrawalRequest[]>(res);
      }
    } catch {}
    return getUserWithdrawals(userId);
  },
  create: async (params: {
    withdrawal: WithdrawalRequest;
    transaction?: Transaction;
    userUpdates?: Partial<UserProfile>;
  }): Promise<{ success: boolean; withdrawal: WithdrawalRequest }> => {
    return withdrawalsApi.request(params.withdrawal, params.transaction);
  },
  request: async (withdrawal: WithdrawalRequest, transaction?: Transaction): Promise<{ success: boolean; withdrawal: WithdrawalRequest }> => {
    try {
      const res = await fetch(apiUrl('/api/withdrawals'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ withdrawal, transaction }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse<{ success: boolean; withdrawal: WithdrawalRequest }>(res);
      }
    } catch {}
    const created = await createWithdrawal(withdrawal.userId, withdrawal);
    return { success: true, withdrawal: created };
  },
  updateStatus: async (
    id: string, 
    status: 'approved' | 'rejected' | 'processing' | 'completed', 
    txHashOrDetails?: string | { txHash?: string; rejectionReason?: string },
    rejectionReason?: string
  ): Promise<void> => {
    let body: any = { status };
    if (typeof txHashOrDetails === 'string') {
      body.txHash = txHashOrDetails;
    } else if (txHashOrDetails && typeof txHashOrDetails === 'object') {
      body = { ...body, ...txHashOrDetails };
    }
    if (rejectionReason) {
      body.rejectionReason = rejectionReason;
    }

    try {
      const res = await fetch(apiUrl(`/api/withdrawals/${id}/status`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) return;
    } catch {}

    const mappedStatus = (status === 'approved' ? 'completed' : status) as 'pending' | 'processing' | 'completed' | 'rejected';
    await updateWithdrawalStatus(
      id, 
      mappedStatus, 
      typeof txHashOrDetails === 'string' ? txHashOrDetails : txHashOrDetails?.txHash,
      rejectionReason || (typeof txHashOrDetails === 'object' ? txHashOrDetails?.rejectionReason : undefined)
    );
  },
};

export const referralsApi = {
  getAll: async (userId?: string): Promise<ReferralMember[]> => {
    try {
      const url = userId ? `/api/referrals?userId=${userId}` : '/api/referrals';
      const res = await fetch(apiUrl(url));
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse<ReferralMember[]>(res);
      }
    } catch {}
    return getUserReferrals(userId);
  },
  getUserReferrals: async (userId: string): Promise<ReferralMember[]> => {
    return referralsApi.getAll(userId);
  },
  getCampaignOverview: async (userId: string): Promise<any> => {
    try {
      const res = await fetch(apiUrl(`/api/referrals/campaign?userId=${userId}`));
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse(res);
      }
    } catch {}
    return calculateUserCampaignStats(userId);
  },
  saveSalaryConfig: async (params: { 
    userId: string; 
    method: 'mpesa' | 'crypto'; 
    destination: string; 
    accountName?: string 
  }): Promise<any> => {
    try {
      const res = await fetch(apiUrl('/api/referrals/salary-config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse(res);
      }
    } catch {}
    const conf = await updateUserSalaryConfig(params.userId, {
      method: params.method,
      destination: params.destination,
      accountName: params.accountName,
      isAutoDisburse: true,
      lastUpdated: new Date().toISOString()
    });
    return { success: true, config: conf };
  },
  recordReminder: async (memberId: string): Promise<boolean> => {
    try {
      const res = await fetch(apiUrl('/api/referrals/remind'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (res.ok) return true;
    } catch {}
    return true;
  },
  processMaturedCommissions: async (): Promise<any> => {
    try {
      const res = await fetch(apiUrl('/api/referrals/process-matured'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse(res);
      }
    } catch {}
    return releaseMaturedCommissions();
  },
  processSundaySalaries: async (force = false): Promise<any> => {
    try {
      const res = await fetch(apiUrl('/api/referrals/process-sunday-salaries'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse(res);
      }
    } catch {}
    return { success: true, message: 'Salaries processed' };
  },
  getPendingCommissions: async (userId?: string): Promise<any[]> => {
    try {
      const url = userId ? `/api/referrals/pending-commissions?userId=${userId}` : '/api/referrals/pending-commissions';
      const res = await fetch(apiUrl(url));
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse<any[]>(res);
      }
    } catch {}
    return getPendingCommissions(userId);
  },
  getWeeklySalaryPayouts: async (userId?: string): Promise<any[]> => {
    try {
      const url = userId ? `/api/referrals/salary-payouts?userId=${userId}` : '/api/referrals/salary-payouts';
      const res = await fetch(apiUrl(url));
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse<any[]>(res);
      }
    } catch {}
    return getWeeklySalaryPayouts(userId);
  },
};

export const settingsApi = {
  get: async (): Promise<PlatformSettings> => {
    try {
      const res = await fetch(apiUrl('/api/settings'));
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        return parseJsonResponse<PlatformSettings>(res);
      }
    } catch {}
    return getPlatformSettings();
  },
  update: async (settings: Partial<PlatformSettings>): Promise<PlatformSettings> => {
    try {
      const res = await fetch(apiUrl('/api/settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await parseJsonResponse(res);
        return data.settings || data;
      }
    } catch {}
    return updatePlatformSettingsInDb(settings);
  },
};
