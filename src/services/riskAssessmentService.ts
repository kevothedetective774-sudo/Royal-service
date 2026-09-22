import { findUserById, updateUserBalance } from './neonDb';
import { KycStatus } from '../types';

export interface AssessTransactionParams {
  userId: string;
  type: 'withdrawal' | 'deposit' | 'investment';
  amountKES: number;
  destination?: string;
  clientIp?: string;
  pastWithdrawalsCount24h?: number;
  totalWithdrawn24hKES?: number;
}

export interface RiskEvaluationResult {
  allowed: boolean;
  reason?: string;
  riskScore: number;
  newRiskScore?: number;
  flagForKyc?: boolean;
  requiresKyc?: boolean;
}

export interface KycSubmission {
  documentType: 'NATIONAL_ID' | 'PASSPORT' | 'DRIVING_LICENSE';
  documentNumber: string;
  fullName: string;
  idFrontUrl?: string;
  idBackUrl?: string;
  selfieUrl?: string;
}

export const RiskAssessmentService = {
  /**
   * Assess velocity, amount thresholds, and account risk for a transaction
   */
  async assessTransactionRisk(params: AssessTransactionParams): Promise<RiskEvaluationResult> {
    const user = await findUserById(params.userId);
    if (!user) {
      return { allowed: false, reason: 'User not found', riskScore: 100, newRiskScore: 100 };
    }

    if (user.isFrozen) {
      return {
        allowed: false,
        reason: `Account suspended: ${user.freezeReason || 'Administrative freeze in place'}`,
        riskScore: 100,
        newRiskScore: 100,
      };
    }

    let currentRiskScore = Number(user.riskScore || 0);

    // High single transaction check (e.g. > 70,000 KES)
    if (params.amountKES > 70000) {
      currentRiskScore = Math.min(100, currentRiskScore + 25);
    }

    // Velocity check
    if (params.pastWithdrawalsCount24h && params.pastWithdrawalsCount24h >= 4) {
      currentRiskScore = Math.min(100, currentRiskScore + 30);
    }

    // KYC Check if user is flagged
    const requiresKyc = user.kycStatus === 'REQUIRED' || currentRiskScore >= 75;

    if (user.kycStatus === 'REQUIRED') {
      return {
        allowed: false,
        reason: 'Identity verification (KYC) is required before this transaction can proceed.',
        riskScore: currentRiskScore,
        newRiskScore: currentRiskScore,
        flagForKyc: true,
        requiresKyc: true,
      };
    }

    return {
      allowed: !requiresKyc,
      riskScore: currentRiskScore,
      newRiskScore: currentRiskScore,
      flagForKyc: currentRiskScore >= 65,
      requiresKyc,
    };
  },

  /**
   * Force or unforce KYC requirement for a user
   */
  async setForceKyc(userId: string, force: boolean, reason?: string) {
    const status: KycStatus = force ? 'REQUIRED' : 'NOT_REQUIRED';
    await updateUserBalance(userId, {
      kycStatus: status,
      riskScore: force ? 70 : 0,
      freezeReason: force ? (reason || 'Compliance verification required') : undefined,
    });
    return { success: true, userId, status, reason };
  },

  /**
   * Submit KYC documents for verification
   */
  async submitKyc(userId: string, submission: KycSubmission) {
    await updateUserBalance(userId, {
      kycStatus: 'SUBMITTED',
      kycData: {
        ...submission,
        submittedAt: new Date().toISOString(),
      },
    });
    return { success: true, userId, status: 'SUBMITTED', message: 'KYC documents submitted for compliance review' };
  },

  /**
   * Admin approves KYC
   */
  async approveKyc(userId: string, adminNotes?: string) {
    await updateUserBalance(userId, {
      kycStatus: 'APPROVED',
      isFrozen: false,
      freezeReason: undefined,
      riskScore: 0,
    });
    return { success: true, userId, status: 'APPROVED', adminNotes };
  },

  /**
   * Admin rejects KYC
   */
  async rejectKyc(userId: string, reason: string) {
    await updateUserBalance(userId, {
      kycStatus: 'REJECTED',
      freezeReason: `KYC Rejected: ${reason}`,
    });
    return { success: true, userId, status: 'REJECTED', reason };
  },
};
