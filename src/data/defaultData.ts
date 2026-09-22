import { 
  InvestmentPackage, 
  PlatformSettings, 
  UserProfile, 
  ActiveInvestment, 
  WithdrawalRequest, 
  ReferralMember, 
  Transaction,
  WeeklySalaryTier 
} from '../types';

export const WEEKLY_SALARY_TIERS: WeeklySalaryTier[] = [
  { minReferrals: 10, weeklySalaryKES: 1000, tierName: 'Royal Knight', badge: '🛡️' },
  { minReferrals: 15, weeklySalaryKES: 1800, tierName: 'Royal Baron', badge: '⚔️' },
  { minReferrals: 25, weeklySalaryKES: 3250, tierName: 'Royal Count', badge: '⚜️' },
  { minReferrals: 50, weeklySalaryKES: 7500, tierName: 'Royal Duke', badge: '👑' },
  { minReferrals: 100, weeklySalaryKES: 18000, tierName: 'Royal Archduke', badge: '💎' },
  { minReferrals: 250, weeklySalaryKES: 50000, tierName: 'Royal Monarch', badge: '🌟' },
];

export const initialPlatformSettings: PlatformSettings = {
  minWithdrawalKES: 1, // Lowered to allow immediate testing with amounts < 10
  minDepositKES: 1,    // Configured for instant PayHero testing (PayHero has 0 fee on < 10 KES)
  mpesaEstimatedHours: 6,
  cryptoInstantEnabled: true,
  tier1CommissionPercent: 7,
  tier2CommissionPercent: 3,
  tier3CommissionPercent: 1,
  usdtToKesExchangeRate: 130,
  platformStatus: 'active',
  mpesaWithdrawalFeePercent: 10,
  cryptoWithdrawalFeePercent: 5,
  polygonUsdtAddress: '0xDD854214Bf1d6826a21A62e9cfdd091ccd18A8c9',
  polygonUsdtNetwork: 'Polygon (MATIC USDT)',
  antiFraudEnabled: true,
  maxDailyWithdrawalKES: 50000,
  withdrawalCooldownHours: 24,
  strictPhoneMatchEnabled: true,
  autoFreezeHighRisk: true,
  payheroChannelId: '11128',
  // Pre-Launch & Official Launch Lock Configuration
  preLaunchMode: false,
  launchDate: '2026-09-26T15:00:00.000Z',
  launchTitle: '🚀 Official Royal Service Platform Live',
  launchAnnouncement: 'Deposits, investments, and automated yields are active! Instant payouts and team referral building are live.',
  lockDeposits: false,
  lockInvestments: false,
  lockWithdrawals: false,
  allowPreRegistrations: true,
  earlyBirdBonusPercent: 10,
};

export const initialPackages: InvestmentPackage[] = [
  {
    id: 'pkg-bronze',
    name: 'Royal Bronze',
    tag: 'Starter Tier',
    priceKES: 500,
    dailyRoiPercent: 8.0,
    durationDays: 20,
    description: 'Entry package paying KES 40/day for exactly 20 days. Capital is non-refundable; contract expires upon completion.',
    isActive: true,
    color: 'from-amber-600 to-amber-700',
    runningSchedule: 'all',
    showRunningDaysToUsers: true,
    features: [
      'Daily 8.0% return (KES 40/day)',
      'Total Payout: KES 800 (160%)',
      'Contract cycle: Exactly 20 Days',
      'Capital Non-Refundable • Expired at term',
      'Instant USDT (Polygon) / M-Pesa payouts',
    ],
  },
  {
    id: 'pkg-silver',
    name: 'Royal Silver',
    tag: 'Most Popular',
    priceKES: 900,
    dailyRoiPercent: 10.0,
    durationDays: 20,
    description: 'Premier balanced package paying KES 90 per day for exactly 20 days. Capital is non-refundable; expires after 20 days.',
    isActive: true,
    color: 'from-emerald-500 to-teal-700',
    runningSchedule: 'all',
    showRunningDaysToUsers: true,
    features: [
      'Daily 10.0% return (KES 90/day)',
      'Total Payout: KES 1,800 (200%)',
      'Contract cycle: Exactly 20 Days',
      'Capital Non-Refundable • Expired at term',
      'Eligible for Multi-tier Team Bonus',
      'Minimum withdrawal from KES 100',
    ],
  },
  {
    id: 'pkg-gold',
    name: 'Royal Gold',
    tag: 'High Yield',
    priceKES: 2500,
    dailyRoiPercent: 10.0,
    durationDays: 20,
    description: 'Accelerated yield contract paying KES 250 per day for exactly 20 days. Capital non-refundable.',
    isActive: true,
    color: 'from-yellow-500 to-amber-600',
    runningSchedule: 'weekdays',
    showRunningDaysToUsers: true,
    features: [
      'Daily 10.0% return (KES 250/day)',
      'Total Payout: KES 5,000 (200%)',
      'Contract cycle: Exactly 20 Days',
      'Capital Non-Refundable • Expired at term',
      'Priority M-Pesa & Instant USDT (Polygon) API',
      'Unlocks Tier 2 & Tier 3 referral booster',
    ],
  },
  {
    id: 'pkg-platinum',
    name: 'Royal Platinum',
    tag: 'Elite Tier',
    priceKES: 6000,
    dailyRoiPercent: 11.0,
    durationDays: 20,
    description: 'Executive capital contract paying KES 660 per day for exactly 20 days. Capital expires without refund.',
    isActive: true,
    color: 'from-purple-600 to-indigo-700',
    runningSchedule: 'all',
    showRunningDaysToUsers: true,
    features: [
      'Daily 11.0% return (KES 660/day)',
      'Total Payout: KES 13,200 (220%)',
      'Contract cycle: Exactly 20 Days',
      'Capital Non-Refundable • Expired at term',
      'Instant settlement on all rails',
      'Direct account manager support',
    ],
  },
];

export const initialUser: UserProfile = {
  id: '',
  name: 'Investor',
  email: '',
  phone: '',
  referralCode: '',
  referredByCode: '',
  walletBalanceKES: 0,
  investedCapitalKES: 0,
  totalEarningsAccruedKES: 0,
  totalReferralBonusKES: 0,
  totalWithdrawnKES: 0,
};

export const initialActiveInvestments: ActiveInvestment[] = [];

export const initialWithdrawals: WithdrawalRequest[] = [];

export const initialReferralMembers: ReferralMember[] = [];

export const initialTransactions: Transaction[] = [];
