import { neon } from '@neondatabase/serverless';
import { 
  UserProfile, 
  InvestmentPackage, 
  ActiveInvestment, 
  Transaction, 
  WithdrawalRequest, 
  ReferralMember, 
  ChatThread, 
  ChatMessage, 
  PlatformSettings, 
  AntiFraudEvent, 
  AntiFraudMetrics,
  PendingCommission,
  WeeklySalaryTier,
  UserSalaryConfig,
  WeeklySalaryPayout,
  CampaignOverview 
} from '../types';
import { initialPackages, initialPlatformSettings, initialReferralMembers, WEEKLY_SALARY_TIERS } from '../data/defaultData';

/**
 * Extracts and sanitizes a valid PostgreSQL connection string.
 * Automatically extracts the URI if the user inadvertently pasted a full Neon console code snippet
 * (e.g., `import { neon } from '@neondatabase/serverless'; const sql = neon('postgresql://...');`),
 * or included surrounding quotes, shell commands, or trailing semicolons.
 */
export function extractPostgresUrl(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Regex to extract postgresql:// or postgres:// URI
  const match = trimmed.match(/(postgres(?:ql)?:\/\/[^\s'"`\)\;]+)/i);
  if (match && match[1]) {
    let url = match[1].trim();
    // Strip trailing quotes, semicolons, brackets, or commas
    url = url.replace(/['"`;\)\],]+$/, '').trim();
    if (/^postgres(?:ql)?:\/\//i.test(url)) {
      return url;
    }
  }

  // Fallback: strip outer quotes
  const cleaned = trimmed.replace(/^['"`]+|['"`]+$/g, '').trim();
  if (/^postgres(?:ql)?:\/\//i.test(cleaned)) {
    return cleaned;
  }

  return null;
}

// Lazy-initialized SQL client
let sqlInstance: any = null;
let lastUsedUrl: string | null = null;

export function getNeonSql() {
  let rawDbUrl: string | undefined = undefined;

  if (typeof process !== 'undefined' && process.env) {
    rawDbUrl = process.env.DATABASE_URL || process.env.VITE_DATABASE_URL;
  }
  if (!rawDbUrl) {
    try {
      const metaEnv = (new Function('return typeof import.meta !== "undefined" ? import.meta.env : undefined'))();
      if (metaEnv) {
        rawDbUrl = metaEnv.VITE_DATABASE_URL || metaEnv.DATABASE_URL;
      }
    } catch {}
  }
  if (!rawDbUrl && typeof window !== 'undefined' && window.localStorage) {
    rawDbUrl = localStorage.getItem('neon_database_url') || localStorage.getItem('DATABASE_URL') || undefined;
  }
  if (!rawDbUrl) {
    rawDbUrl = 'postgresql://neondb_owner:npg_TXm6UtSlW7Ae@ep-little-hall-b5o6vcsm-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  }

  const cleanUrl = extractPostgresUrl(rawDbUrl);

  if (cleanUrl) {
    if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL !== cleanUrl) {
      process.env.DATABASE_URL = cleanUrl;
    }

    if (!sqlInstance || lastUsedUrl !== cleanUrl) {
      try {
        sqlInstance = neon(cleanUrl);
        lastUsedUrl = cleanUrl;
        console.log('[Neon DB] Successfully connected neon client to PostgreSQL database.');
      } catch (err) {
        console.warn('[Neon DB] Failed to create neon client with extracted URL:', err);
        sqlInstance = null;
      }
    }
  } else if (!sqlInstance && rawDbUrl) {
    console.warn('[Neon DB] DATABASE_URL provided but could not extract a valid PostgreSQL connection URI.');
  }

  return sqlInstance;
}

// In-memory fallback stores for when DATABASE_URL is not yet connected or during local dev
let inMemoryUsers: Map<string, any> = new Map();
let inMemoryPackages: InvestmentPackage[] = [...initialPackages];
let inMemoryInvestments: ActiveInvestment[] = [];
let inMemoryTransactions: Transaction[] = [];
let inMemoryWithdrawals: WithdrawalRequest[] = [];
let inMemoryReferrals: ReferralMember[] = [];
let inMemoryThreads: ChatThread[] = [];
let inMemorySettings: PlatformSettings = { ...initialPlatformSettings };
let inMemoryAntiFraudEvents: AntiFraudEvent[] = [];
let inMemoryPendingCommissions: PendingCommission[] = [];
let inMemoryWeeklySalaryPayouts: WeeklySalaryPayout[] = [];

// Prepopulate accounts in in-memory store
inMemoryUsers.set('usr-admin-royal', {
  id: 'usr-admin-royal',
  name: 'Royal Administrator',
  email: 'admin@royalservices.ke',
  phone: '+254700000001',
  passwordHash: 'AdminSecure2026!',
  referralCode: 'ROYAL-ADMIN',
  walletBalanceKES: 50000,
  investedCapitalKES: 100000,
  totalEarningsAccruedKES: 25000,
  totalReferralBonusKES: 15000,
  totalWithdrawnKES: 10000,
  role: 'admin',
  createdAt: new Date().toISOString()
});

inMemoryUsers.set('usr-support-vip', {
  id: 'usr-support-vip',
  name: 'VIP Support Desk',
  email: 'support@royalservices.ke',
  phone: '+254700000002',
  passwordHash: 'Support@Royal2026',
  referralCode: 'ROYAL-SUPPORT',
  walletBalanceKES: 25000,
  investedCapitalKES: 50000,
  totalEarningsAccruedKES: 12000,
  totalReferralBonusKES: 8000,
  totalWithdrawnKES: 5000,
  role: 'support',
  createdAt: new Date().toISOString()
});

/**
 * Initialize PostgreSQL schema and tables if connected to Neon
 */
export async function initNeonSchema(): Promise<boolean> {
  const sql = getNeonSql();
  if (!sql) {
    console.info('[Neon DB] No DATABASE_URL found or client inactive. Using high-speed transactional memory layer.');
    return true;
  }

  try {
    // 1. Users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(64) UNIQUE,
        password_hash VARCHAR(255),
        referral_code VARCHAR(64) UNIQUE,
        referred_by_code VARCHAR(64),
        wallet_balance_kes NUMERIC(15, 2) DEFAULT 100.00,
        invested_capital_kes NUMERIC(15, 2) DEFAULT 0.00,
        total_earnings_accrued_kes NUMERIC(15, 2) DEFAULT 0.00,
        total_referral_bonus_kes NUMERIC(15, 2) DEFAULT 0.00,
        total_withdrawn_kes NUMERIC(15, 2) DEFAULT 0.00,
        is_frozen BOOLEAN DEFAULT FALSE,
        risk_score NUMERIC(5, 2) DEFAULT 0.00,
        freeze_reason TEXT,
        kyc_status VARCHAR(32) DEFAULT 'NONE',
        kyc_data JSONB,
        role VARCHAR(32) DEFAULT 'user',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 2. Packages table
    await sql`
      CREATE TABLE IF NOT EXISTS packages (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        tag VARCHAR(64),
        price_kes NUMERIC(15, 2) NOT NULL,
        daily_roi_percent NUMERIC(5, 2) NOT NULL,
        duration_days INT NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        color VARCHAR(64),
        features JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 3. Investments table
    await sql`
      CREATE TABLE IF NOT EXISTS investments (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        package_id VARCHAR(64) NOT NULL,
        package_name VARCHAR(255) NOT NULL,
        amount_kes NUMERIC(15, 2) NOT NULL,
        daily_roi_percent NUMERIC(5, 2) NOT NULL,
        daily_return_kes NUMERIC(15, 2) NOT NULL,
        duration_days INT NOT NULL,
        days_elapsed INT DEFAULT 0,
        total_earned_kes NUMERIC(15, 2) DEFAULT 0.00,
        unclaimed_yield_kes NUMERIC(15, 2) DEFAULT 0.00,
        status VARCHAR(32) DEFAULT 'active',
        start_date VARCHAR(64),
        last_claim_date VARCHAR(64),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 4. Transactions table
    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        type VARCHAR(32) NOT NULL,
        amount_kes NUMERIC(15, 2) NOT NULL,
        description TEXT,
        date_str VARCHAR(64),
        status VARCHAR(32) DEFAULT 'completed',
        reference VARCHAR(255),
        destination TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 5. Withdrawals table
    await sql`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        user_name VARCHAR(255),
        amount_kes NUMERIC(15, 2) NOT NULL,
        fee_kes NUMERIC(15, 2) DEFAULT 0.00,
        net_amount_kes NUMERIC(15, 2) NOT NULL,
        method VARCHAR(32) NOT NULL,
        destination TEXT NOT NULL,
        account_name TEXT,
        status VARCHAR(32) DEFAULT 'pending',
        created_at_str VARCHAR(64),
        estimated_delivery VARCHAR(64),
        tx_hash_or_ref VARCHAR(255),
        rejection_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 6. Referrals table
    await sql`
      CREATE TABLE IF NOT EXISTS referrals (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone_or_email VARCHAR(255),
        phone VARCHAR(64),
        email VARCHAR(255),
        tier INT DEFAULT 1,
        referred_by VARCHAR(64) NOT NULL,
        joined_date VARCHAR(64),
        registered_at VARCHAR(64),
        total_deposited_kes NUMERIC(15, 2) DEFAULT 0.00,
        commission_earned_kes NUMERIC(15, 2) DEFAULT 0.00,
        package_active VARCHAR(64),
        status VARCHAR(32) DEFAULT 'active',
        last_contacted_date VARCHAR(64),
        reminder_count INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // Migration for existing referrals tables
    try {
      await sql`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS phone VARCHAR(64);`;
      await sql`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS email VARCHAR(255);`;
      await sql`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS registered_at VARCHAR(64);`;
      await sql`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS last_contacted_date VARCHAR(64);`;
      await sql`ALTER TABLE referrals ADD COLUMN IF NOT EXISTS reminder_count INT DEFAULT 0;`;
    } catch (migErr) {
      console.warn('[Neon DB] Referrals migration notice:', migErr);
    }

    // 7. Chat threads table
    await sql`
      CREATE TABLE IF NOT EXISTS chat_threads (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        user_name VARCHAR(255),
        user_phone VARCHAR(64),
        user_email VARCHAR(255),
        user_referral_code VARCHAR(64),
        status VARCHAR(32) DEFAULT 'active',
        unread_count_user INT DEFAULT 0,
        unread_count_admin INT DEFAULT 0,
        last_message_time VARCHAR(64),
        last_message_snippet TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 8. Chat messages table
    await sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR(64) PRIMARY KEY,
        thread_id VARCHAR(64) NOT NULL,
        sender VARCHAR(32) NOT NULL,
        sender_name VARCHAR(255),
        text TEXT,
        timestamp_str VARCHAR(64),
        is_read BOOLEAN DEFAULT FALSE,
        voice_note JSONB,
        attachment JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 9. Platform settings table
    await sql`
      CREATE TABLE IF NOT EXISTS platform_settings (
        id VARCHAR(64) PRIMARY KEY,
        settings JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 10. Anti-fraud events table
    await sql`
      CREATE TABLE IF NOT EXISTS antifraud_events (
        id VARCHAR(64) PRIMARY KEY,
        event_type VARCHAR(64) NOT NULL,
        user_id VARCHAR(64),
        user_identifier VARCHAR(255),
        risk_score NUMERIC(5, 2) DEFAULT 0.00,
        severity VARCHAR(32) DEFAULT 'low',
        action_taken VARCHAR(64) DEFAULT 'LOGGED',
        details TEXT,
        ip_address VARCHAR(128),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 11. Pending Commissions table (72-Hour Anti-Sybil Fraud Vesting)
    await sql`
      CREATE TABLE IF NOT EXISTS pending_commissions (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        from_user_id VARCHAR(64) NOT NULL,
        from_user_name VARCHAR(255),
        deposit_amount_kes NUMERIC(15, 2) NOT NULL,
        commission_amount_kes NUMERIC(15, 2) NOT NULL,
        commission_percent NUMERIC(5, 2) DEFAULT 10.0,
        status VARCHAR(32) DEFAULT 'pending',
        unlock_at TIMESTAMPTZ NOT NULL,
        is_unlocked BOOLEAN DEFAULT FALSE,
        unlocked_at TIMESTAMPTZ,
        risk_score NUMERIC(5, 2) DEFAULT 0.00,
        flag_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 12. Weekly Salary Payouts table (Automated Sunday Payouts to M-Pesa / USDT)
    await sql`
      CREATE TABLE IF NOT EXISTS weekly_salary_payouts (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        user_name VARCHAR(255),
        week_ending_date VARCHAR(32) NOT NULL,
        qualifying_referrals INT NOT NULL,
        amount_kes NUMERIC(15, 2) NOT NULL,
        method VARCHAR(32) NOT NULL,
        destination TEXT NOT NULL,
        status VARCHAR(32) DEFAULT 'completed',
        tx_hash_or_ref VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 13. Run safe schema migrations for existing database instances
    try {
      await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference VARCHAR(255);`;
      await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_code VARCHAR(255);`;
      await sql`UPDATE transactions SET reference = reference_code WHERE reference IS NULL AND reference_code IS NOT NULL;`;
      await sql`UPDATE transactions SET reference_code = reference WHERE reference_code IS NULL AND reference IS NOT NULL;`;
      await sql`ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS settings JSONB;`;
      await sql`ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS rejection_reason TEXT;`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS salary_config JSONB;`;
    } catch (migErr) {
      console.warn('[Neon DB] Safe migration notice:', migErr);
    }

    // Seed packages if empty
    const pkgCount = await sql`SELECT COUNT(*) as count FROM packages;`;
    if (Number(pkgCount[0]?.count || 0) === 0) {
      for (const p of initialPackages) {
        await sql`
          INSERT INTO packages (
            id, name, tag, price_kes, daily_roi_percent, duration_days, description, is_active, color, features
          ) VALUES (
            ${p.id}, ${p.name}, ${p.tag || ''}, ${p.priceKES}, ${p.dailyRoiPercent}, ${p.durationDays}, 
            ${p.description}, ${p.isActive}, ${p.color}, ${JSON.stringify(p.features)}
          );
        `;
      }
      console.log('[Neon DB] Seeded initial investment packages into Neon PostgreSQL.');
    }

    // Seed default Admin, Support, and Demo accounts into Neon PostgreSQL
    try {
      await sql`
        INSERT INTO users (
          id, name, email, phone, password_hash, referral_code, wallet_balance_kes, invested_capital_kes, role
        ) VALUES
          ('usr-admin-royal', 'Royal Administrator', 'admin@royalservices.ke', '+254700000001', 'AdminSecure2026!', 'ROYAL-ADMIN', 50000.00, 100000.00, 'admin'),
          ('usr-support-vip', 'VIP Support Desk', 'support@royalservices.ke', '+254700000002', 'Support@Royal2026', 'ROYAL-SUPPORT', 25000.00, 50000.00, 'support')
        ON CONFLICT (email) DO UPDATE SET 
          password_hash = EXCLUDED.password_hash, 
          role = EXCLUDED.role, 
          name = EXCLUDED.name;
      `;
      console.log('[Neon DB] Seeded/Verified Admin and Support credentials in Neon DB.');
    } catch (userSeedErr) {
      console.warn('[Neon DB] User seed notice:', userSeedErr);
    }

    return true;
  } catch (err) {
    console.error('[Neon DB] Schema init error:', err);
    return false;
  }
}

export async function getDbStatus(): Promise<any> {
  const sql = getNeonSql();
  if (!sql) {
    return {
      connected: true,
      isNeonConnected: false,
      database: 'memory-tier',
      status: 'active',
      tables: {
        users: inMemoryUsers.size,
        packages: inMemoryPackages.length,
        investments: inMemoryInvestments.length,
        transactions: inMemoryTransactions.length,
        withdrawals: inMemoryWithdrawals.length,
        referrals: inMemoryReferrals.length,
        chat_threads: inMemoryThreads.length,
        antifraud_events: inMemoryAntiFraudEvents.length,
      },
    };
  }

  try {
    const [u, p, i, t, w, r] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM users;`,
      sql`SELECT COUNT(*) as count FROM packages;`,
      sql`SELECT COUNT(*) as count FROM investments;`,
      sql`SELECT COUNT(*) as count FROM transactions;`,
      sql`SELECT COUNT(*) as count FROM withdrawals;`,
      sql`SELECT COUNT(*) as count FROM referrals;`,
    ]);

    return {
      connected: true,
      isNeonConnected: true,
      database: 'neon-postgresql',
      status: 'healthy',
      tables: {
        users: Number(u[0]?.count || 0),
        packages: Number(p[0]?.count || 0),
        investments: Number(i[0]?.count || 0),
        transactions: Number(t[0]?.count || 0),
        withdrawals: Number(w[0]?.count || 0),
        referrals: Number(r[0]?.count || 0),
      }
    };
  } catch (err: any) {
    return {
      connected: false,
      isNeonConnected: false,
      error: err.message,
      fallbackMode: true,
      tables: {
        users: inMemoryUsers.size,
        packages: inMemoryPackages.length,
      }
    };
  }
}

// User Helpers
export function getPhoneVariants(raw: string): string[] {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  const set = new Set<string>();
  set.add(trimmed);
  set.add(trimmed.replace(/\s+/g, ''));
  if (digits.length === 10 && digits.startsWith('0')) {
    set.add(digits);
    set.add(`+254${digits.slice(1)}`);
    set.add(`254${digits.slice(1)}`);
    set.add(`+254 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`);
  } else if (digits.length === 12 && digits.startsWith('254')) {
    set.add(digits);
    set.add(`+${digits}`);
    set.add(`0${digits.slice(3)}`);
    set.add(`+254 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`);
  } else if (digits.length === 9) {
    set.add(`0${digits}`);
    set.add(`+254${digits}`);
    set.add(`254${digits}`);
    set.add(`+254 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`);
  }
  return Array.from(set);
}

export async function findUserByEmailOrPhone(identifier: string, candidatePassword?: string): Promise<any> {
  const clean = identifier.trim().toLowerCase();
  const phoneVariants = getPhoneVariants(identifier);
  const digits = identifier.replace(/\D/g, '');
  const last9 = digits.length >= 9 ? digits.slice(-9) : '';
  const sql = getNeonSql();
  const cleanPassword = candidatePassword ? candidatePassword.trim() : undefined;

  if (sql) {
    try {
      let rows: any[] = [];
      if (last9) {
        rows = await sql`
          SELECT * FROM users 
          WHERE LOWER(TRIM(email)) = ${clean} 
             OR phone = ANY(${phoneVariants})
             OR RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 9) = ${last9}
             OR LOWER(referral_code) = ${clean}
             OR id = ${clean}
             OR LOWER(TRIM(name)) = ${clean}
          ORDER BY 
            CASE 
              WHEN LOWER(TRIM(email)) = ${clean} THEN 1
              WHEN phone = ANY(${phoneVariants}) THEN 2
              WHEN LOWER(referral_code) = ${clean} THEN 3
              WHEN id = ${clean} THEN 4
              ELSE 5
            END ASC,
            is_frozen ASC,
            id DESC
          LIMIT 10;
        `;
      } else {
        rows = await sql`
          SELECT * FROM users 
          WHERE LOWER(TRIM(email)) = ${clean} 
             OR phone = ANY(${phoneVariants})
             OR LOWER(referral_code) = ${clean}
             OR id = ${clean}
             OR LOWER(TRIM(name)) = ${clean}
          ORDER BY 
            CASE 
              WHEN LOWER(TRIM(email)) = ${clean} THEN 1
              WHEN phone = ANY(${phoneVariants}) THEN 2
              WHEN LOWER(referral_code) = ${clean} THEN 3
              WHEN id = ${clean} THEN 4
              ELSE 5
            END ASC,
            is_frozen ASC,
            id DESC
          LIMIT 10;
        `;
      }
      
      if (rows && rows.length > 0) {
        // If password is provided, prioritize candidate user whose password matches
        if (cleanPassword !== undefined) {
          const passwordMatched = rows.find(r => {
            const pass = r.password_hash || r.passwordHash || '';
            return pass === candidatePassword || pass.trim() === cleanPassword;
          });
          if (passwordMatched) return mapUserRow(passwordMatched);
        }
        return mapUserRow(rows[0]);
      }
    } catch (err) {
      console.warn('[Neon DB] findUserByEmailOrPhone fallback:', err);
    }
  }

  const inMemCandidates: any[] = [];
  for (const u of inMemoryUsers.values()) {
    const uEmail = (u.email || '').trim().toLowerCase();
    const uPhoneDigits = (u.phone || '').replace(/\D/g, '');
    const uRef = (u.referralCode || '').trim().toLowerCase();
    const uName = (u.name || '').trim().toLowerCase();

    if (clean && (uEmail === clean || u.id === clean || uRef === clean)) {
      inMemCandidates.push(u);
    } else if (phoneVariants.includes((u.phone || '').trim()) || phoneVariants.includes((u.phone || '').replace(/\s+/g, ''))) {
      inMemCandidates.push(u);
    } else if (last9 && uPhoneDigits.length >= 9 && uPhoneDigits.slice(-9) === last9) {
      inMemCandidates.push(u);
    } else if (clean && uName === clean) {
      inMemCandidates.push(u);
    }
  }

  if (inMemCandidates.length > 0) {
    if (cleanPassword !== undefined) {
      const matched = inMemCandidates.find(u => {
        const pass = u.passwordHash || '';
        return pass === candidatePassword || pass.trim() === cleanPassword;
      });
      if (matched) return matched;
    }
    // Return unbanned first
    inMemCandidates.sort((a, b) => (a.isFrozen === b.isFrozen ? 0 : a.isFrozen ? 1 : -1));
    return inMemCandidates[0];
  }

  return null;
}

export async function findUserById(id: string): Promise<any> {
  const sql = getNeonSql();
  if (sql) {
    try {
      const rows: any[] = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1;`;
      if (rows && rows.length > 0) return mapUserRow(rows[0]);
    } catch (err) {
      console.warn('[Neon DB] findUserById fallback:', err);
    }
  }
  return inMemoryUsers.get(id) || null;
}

export async function createUser(data: {
  name: string;
  email: string;
  phone: string;
  password: string;
  referredByCode?: string;
}): Promise<any> {
  const id = `usr-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5)}`;
  const referralCode = `ROYAL-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const initialBalance = 100.00; // Starter Bonus

  const newUser: any = {
    id,
    name: data.name,
    email: data.email,
    phone: data.phone,
    passwordHash: data.password,
    referralCode,
    referredByCode: data.referredByCode || undefined,
    walletBalanceKES: initialBalance,
    investedCapitalKES: 0,
    totalEarningsAccruedKES: 0,
    totalReferralBonusKES: 0,
    totalWithdrawnKES: 0,
    isFrozen: false,
    riskScore: 0,
    kycStatus: 'NOT_REQUIRED',
    role: 'user',
    createdAt: new Date().toISOString()
  };

  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO users (
          id, name, email, phone, password_hash, referral_code, referred_by_code,
          wallet_balance_kes, invested_capital_kes, total_earnings_accrued_kes,
          total_referral_bonus_kes, total_withdrawn_kes, is_frozen, risk_score, kyc_status, role
        ) VALUES (
          ${newUser.id}, ${newUser.name}, ${newUser.email}, ${newUser.phone}, ${newUser.passwordHash},
          ${newUser.referralCode}, ${newUser.referredByCode || null}, ${newUser.walletBalanceKES},
          ${newUser.investedCapitalKES}, ${newUser.totalEarningsAccruedKES}, ${newUser.totalReferralBonusKES},
          ${newUser.totalWithdrawnKES}, ${newUser.isFrozen}, ${newUser.riskScore}, ${newUser.kycStatus}, ${newUser.role}
        );
      `;
    } catch (err) {
      console.warn('[Neon DB] createUser DB insert error, stored in memory:', err);
    }
  }

  inMemoryUsers.set(id, newUser);
  return newUser;
}

export async function listAllUsers(): Promise<UserProfile[]> {
  const sql = getNeonSql();
  if (sql) {
    try {
      const rows: any[] = await sql`SELECT * FROM users ORDER BY created_at DESC;`;
      return rows.map((r: any) => mapUserRow(r));
    } catch (err) {
      console.warn('[Neon DB] listAllUsers fallback:', err);
    }
  }
  return Array.from(inMemoryUsers.values()).map(u => mapUserRow(u));
}

export async function updateUserBalance(id: string, updates: Partial<UserProfile>): Promise<void> {
  const sql = getNeonSql();
  if (sql) {
    try {
      if (updates.walletBalanceKES !== undefined) {
        await sql`UPDATE users SET wallet_balance_kes = ${updates.walletBalanceKES} WHERE id = ${id};`;
      }
      if (updates.investedCapitalKES !== undefined) {
        await sql`UPDATE users SET invested_capital_kes = ${updates.investedCapitalKES} WHERE id = ${id};`;
      }
      if (updates.totalEarningsAccruedKES !== undefined) {
        await sql`UPDATE users SET total_earnings_accrued_kes = ${updates.totalEarningsAccruedKES} WHERE id = ${id};`;
      }
      if (updates.totalReferralBonusKES !== undefined) {
        await sql`UPDATE users SET total_referral_bonus_kes = ${updates.totalReferralBonusKES} WHERE id = ${id};`;
      }
      if (updates.totalWithdrawnKES !== undefined) {
        await sql`UPDATE users SET total_withdrawn_kes = ${updates.totalWithdrawnKES} WHERE id = ${id};`;
      }
      if (updates.isFrozen !== undefined) {
        await sql`UPDATE users SET is_frozen = ${updates.isFrozen} WHERE id = ${id};`;
        if (updates.isFrozen === false && updates.freezeReason === undefined) {
          await sql`UPDATE users SET freeze_reason = NULL WHERE id = ${id};`;
        }
      }
      if (updates.freezeReason !== undefined) {
        if (updates.freezeReason === null || updates.freezeReason === '' || updates.freezeReason === undefined) {
          await sql`UPDATE users SET freeze_reason = NULL WHERE id = ${id};`;
        } else {
          await sql`UPDATE users SET freeze_reason = ${updates.freezeReason} WHERE id = ${id};`;
        }
      }
      if (updates.kycStatus !== undefined) {
        await sql`UPDATE users SET kyc_status = ${updates.kycStatus} WHERE id = ${id};`;
      }
      if (updates.riskScore !== undefined) {
        await sql`UPDATE users SET risk_score = ${updates.riskScore} WHERE id = ${id};`;
      }
      if (updates.role !== undefined) {
        await sql`UPDATE users SET role = ${updates.role} WHERE id = ${id};`;
      }
      if (updates.passwordHash !== undefined) {
        await sql`UPDATE users SET password_hash = ${updates.passwordHash} WHERE id = ${id};`;
      }
      if (updates.kycData !== undefined) {
        await sql`UPDATE users SET kyc_data = ${JSON.stringify(updates.kycData)} WHERE id = ${id};`;
      }
    } catch (err) {
      console.warn('[Neon DB] updateUserBalance DB query error:', err);
    }
  }

  const existing = inMemoryUsers.get(id);
  if (existing) {
    Object.assign(existing, updates);
  }
}

export async function adjustUserBalance(
  id: string,
  amountKES: number,
  action: 'add' | 'deduct',
  type: 'wallet' | 'invested' = 'wallet',
  reason: string = 'Admin balance adjustment'
): Promise<UserProfile> {
  const user = await findUserById(id);
  if (!user) {
    throw new Error(`User with ID ${id} not found`);
  }

  const cleanAmount = Math.abs(Number(amountKES) || 0);
  let newWallet = user.walletBalanceKES;
  let newInvested = user.investedCapitalKES;

  if (type === 'invested') {
    newInvested = action === 'add' 
      ? newInvested + cleanAmount 
      : Math.max(0, newInvested - cleanAmount);
  } else {
    newWallet = action === 'add' 
      ? newWallet + cleanAmount 
      : Math.max(0, newWallet - cleanAmount);
  }

  await updateUserBalance(id, {
    walletBalanceKES: newWallet,
    investedCapitalKES: newInvested,
  });

  // Record audit transaction
  try {
    const auditTx: Transaction = {
      id: `tx-adj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: id,
      type: action === 'add' ? 'deposit' : 'withdrawal',
      amountKES: cleanAmount,
      amountUSDT: Math.round((cleanAmount / 130) * 100) / 100,
      description: `Admin ${action === 'add' ? 'Credit' : 'Debit'} (${type.toUpperCase()}): ${reason}`,
      status: 'completed',
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString(),
      reference: `ADMIN-${action.toUpperCase()}-${Date.now().toString().slice(-6)}`,
      paymentMethod: 'ADMIN_MANUAL'
    };
    await createTransaction(id, auditTx);
  } catch (txErr) {
    console.warn('[Neon DB] adjustUserBalance audit tx error:', txErr);
  }

  const updated = await findUserById(id);
  return updated!;
}

/**
 * Wipe / Forfeit invested capital and cancel all active investments for terms violation
 */
export async function wipeUserInvestments(userId: string, reason: string = 'Violated terms - capital liquidated'): Promise<{ user: UserProfile; wipedInvestmentsCount: number; liquidatedAmountKES: number }> {
  const user = await findUserById(userId);
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  const liquidatedAmountKES = user.investedCapitalKES || 0;
  let wipedInvestmentsCount = 0;
  const sql = getNeonSql();

  if (sql) {
    try {
      // 1. Cancel all active investments for this user
      const result = await sql`
        UPDATE investments 
        SET status = 'cancelled' 
        WHERE user_id = ${userId} AND status = 'active'
        RETURNING id;
      `;
      wipedInvestmentsCount = result.length;

      // 2. Set user invested capital to 0
      await sql`UPDATE users SET invested_capital_kes = 0 WHERE id = ${userId};`;
    } catch (err) {
      console.warn('[Neon DB] wipeUserInvestments DB error:', err);
    }
  }

  // Update in-memory
  for (const inv of inMemoryInvestments) {
    if ((inv as any).userId === userId && inv.status === 'active') {
      inv.status = 'cancelled';
      wipedInvestmentsCount++;
    }
  }

  const inMemUser = inMemoryUsers.get(userId);
  if (inMemUser) {
    inMemUser.investedCapitalKES = 0;
  }

  // Audit transaction
  try {
    const auditTx: Transaction = {
      id: `tx-forfeit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId,
      type: 'withdrawal',
      amountKES: liquidatedAmountKES,
      amountUSDT: Math.round((liquidatedAmountKES / 130) * 100) / 100,
      description: `Administrative Liquidation: Forfeited KES ${liquidatedAmountKES.toLocaleString()} invested capital due to terms violation (${reason})`,
      status: 'completed',
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString(),
      reference: `FORFEIT-${Date.now().toString().slice(-6)}`,
      paymentMethod: 'ADMIN_PENALTY'
    };
    await createTransaction(userId, auditTx);
  } catch (e) {
    console.warn('[Neon DB] wipeUserInvestments audit tx log error:', e);
  }

  // Anti-fraud event
  try {
    await logAntiFraudEvent({
      id: `afe-wipe-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      eventType: 'SUSPICIOUS_TRANSFER',
      userId,
      riskScore: 100,
      severity: 'high',
      actionTaken: 'INVESTMENT_LIQUIDATED',
      details: `Terms violation: Administrative wipe of KES ${liquidatedAmountKES.toLocaleString()} invested capital. Reason: ${reason}`,
      createdAt: new Date().toISOString()
    });
  } catch (e) {
    console.warn('[Neon DB] wipeUserInvestments antifraud event error:', e);
  }

  const updatedUser = await findUserById(userId);
  return {
    user: updatedUser!,
    wipedInvestmentsCount,
    liquidatedAmountKES
  };
}

/**
 * Wipe user wallet balance to 0
 */
export async function wipeUserWallet(userId: string, reason: string = 'Administrative forfeiture'): Promise<UserProfile> {
  const user = await findUserById(userId);
  if (!user) throw new Error(`User ${userId} not found`);

  const wipedAmount = user.walletBalanceKES || 0;
  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`UPDATE users SET wallet_balance_kes = 0 WHERE id = ${userId};`;
    } catch (err) {
      console.warn('[Neon DB] wipeUserWallet DB error:', err);
    }
  }

  const inMem = inMemoryUsers.get(userId);
  if (inMem) inMem.walletBalanceKES = 0;

  try {
    const auditTx: Transaction = {
      id: `tx-wipe-w-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId,
      type: 'withdrawal',
      amountKES: wipedAmount,
      amountUSDT: Math.round((wipedAmount / 130) * 100) / 100,
      description: `Wallet Balance Wiped (KES ${wipedAmount.toLocaleString()} liquidated). Reason: ${reason}`,
      status: 'completed',
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString(),
      reference: `WIPE-WALLET-${Date.now().toString().slice(-6)}`,
      paymentMethod: 'ADMIN_PENALTY'
    };
    await createTransaction(userId, auditTx);
  } catch (e) {
    console.warn('[Neon DB] wipeUserWallet tx error:', e);
  }

  const updated = await findUserById(userId);
  return updated!;
}

/**
 * Wipe all logs, transactions, and failed deposit history for a specific user
 */
export async function wipeUserTransactions(userId: string): Promise<{ deletedCount: number }> {
  let deletedCount = 0;
  const sql = getNeonSql();

  if (sql) {
    try {
      const txRes = await sql`DELETE FROM transactions WHERE user_id = ${userId} RETURNING id;`;
      deletedCount += txRes.length;
    } catch (err) {
      console.warn('[Neon DB] wipeUserTransactions transactions error:', err);
    }
  }

  const beforeLen = inMemoryTransactions.length;
  inMemoryTransactions = inMemoryTransactions.filter((tx: any) => tx.userId !== userId);
  deletedCount += (beforeLen - inMemoryTransactions.length);

  return { deletedCount };
}

/**
 * Permanently purge/delete user account and all associated records
 */
export async function deleteUserAccount(userId: string): Promise<boolean> {
  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`DELETE FROM investments WHERE user_id = ${userId};`;
      await sql`DELETE FROM transactions WHERE user_id = ${userId};`;
      await sql`DELETE FROM withdrawals WHERE user_id = ${userId};`;
      await sql`DELETE FROM referrals WHERE referred_by = ${userId} OR member_id = ${userId};`;
      await sql`DELETE FROM antifraud_events WHERE user_id = ${userId};`;
      await sql`DELETE FROM users WHERE id = ${userId};`;
    } catch (err) {
      console.warn('[Neon DB] deleteUserAccount DB error:', err);
    }
  }

  inMemoryUsers.delete(userId);
  inMemoryInvestments = inMemoryInvestments.filter((i: any) => i.userId !== userId);
  inMemoryTransactions = inMemoryTransactions.filter((t: any) => t.userId !== userId);
  inMemoryWithdrawals = inMemoryWithdrawals.filter((w: any) => w.userId !== userId);

  return true;
}

/**
 * Admin reset or view user password
 */
export async function resetUserPasswordByAdmin(userId: string, newPassword: string): Promise<boolean> {
  if (!newPassword || newPassword.trim().length < 4) {
    throw new Error('Password must be at least 4 characters long');
  }

  const cleanPassword = newPassword.trim();
  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`UPDATE users SET password_hash = ${cleanPassword} WHERE id = ${userId};`;
    } catch (err) {
      console.warn('[Neon DB] resetUserPasswordByAdmin DB error:', err);
    }
  }

  const inMem = inMemoryUsers.get(userId);
  if (inMem) {
    inMem.passwordHash = cleanPassword;
  }

  return true;
}

/**
 * Platform-wide wipe of all failed, rejected, or canceled deposit attempts
 */
export async function wipeFailedDeposits(): Promise<{ purgedTransactionsCount: number }> {
  let purgedCount = 0;
  const sql = getNeonSql();

  if (sql) {
    try {
      const rows = await sql`
        DELETE FROM transactions 
        WHERE status IN ('failed', 'rejected', 'cancelled') 
           OR (type = 'deposit' AND status = 'pending' AND created_at < NOW() - INTERVAL '2 hours')
        RETURNING id;
      `;
      purgedCount = rows.length;
    } catch (err) {
      console.warn('[Neon DB] wipeFailedDeposits DB error:', err);
    }
  }

  const beforeLen = inMemoryTransactions.length;
  inMemoryTransactions = inMemoryTransactions.filter(
    tx => tx.status !== 'failed' && tx.status !== 'rejected' && tx.status !== 'cancelled'
  );
  purgedCount += Math.max(0, beforeLen - inMemoryTransactions.length);

  return { purgedTransactionsCount: purgedCount };
}

/**
 * Batch liquidate invested capital & wallet balances from all currently frozen accounts
 */
export async function liquidateAllFrozenUsers(): Promise<{ frozenUsersLiquidated: number; totalLiquidatedKES: number }> {
  let count = 0;
  let totalKES = 0;

  const users = await listAllUsers();
  const frozenUsers = users.filter(u => u.isFrozen);

  for (const u of frozenUsers) {
    const userKES = (u.investedCapitalKES || 0) + (u.walletBalanceKES || 0);
    if (userKES > 0) {
      totalKES += userKES;
      count++;
      await wipeUserInvestments(u.id, 'Batch administrative liquidation of banned account');
      await wipeUserWallet(u.id, 'Batch administrative liquidation of banned account');
    }
  }

  return { frozenUsersLiquidated: count, totalLiquidatedKES: totalKES };
}

/**
 * Wipe all anti-fraud logs
 */
export async function wipeAllAntiFraudLogs(): Promise<{ purgedLogsCount: number }> {
  let count = 0;
  const sql = getNeonSql();
  if (sql) {
    try {
      const rows = await sql`DELETE FROM antifraud_events RETURNING id;`;
      count = rows.length;
    } catch (err) {
      console.warn('[Neon DB] wipeAllAntiFraudLogs DB error:', err);
    }
  }

  count += inMemoryAntiFraudEvents.length;
  inMemoryAntiFraudEvents = [];
  return { purgedLogsCount: count };
}

/**
 * Emergency Platform Activity Wipe (preserves admin accounts)
 */
export async function resetAllPlatformActivity(): Promise<{ resetSuccess: boolean }> {
  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`DELETE FROM investments;`;
      await sql`DELETE FROM transactions;`;
      await sql`DELETE FROM withdrawals;`;
      await sql`DELETE FROM antifraud_events;`;
      await sql`UPDATE users SET wallet_balance_kes = 0, invested_capital_kes = 0, total_earnings_accrued_kes = 0, total_withdrawn_kes = 0 WHERE role != 'admin';`;
    } catch (err) {
      console.warn('[Neon DB] resetAllPlatformActivity DB error:', err);
    }
  }

  inMemoryInvestments = [];
  inMemoryTransactions = [];
  inMemoryWithdrawals = [];
  inMemoryAntiFraudEvents = [];
  for (const u of inMemoryUsers.values()) {
    if (u.role !== 'admin') {
      u.walletBalanceKES = 0;
      u.investedCapitalKES = 0;
      u.totalEarningsAccruedKES = 0;
      u.totalWithdrawnKES = 0;
    }
  }

  return { resetSuccess: true };
}

// Packages
export async function getAllPackages(): Promise<InvestmentPackage[]> {
  const sql = getNeonSql();
  if (sql) {
    try {
      const rows: any[] = await sql`SELECT * FROM packages ORDER BY price_kes ASC;`;
      if (rows && rows.length > 0) {
        return rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          tag: r.tag,
          priceKES: Number(r.price_kes),
          dailyRoiPercent: Number(r.daily_roi_percent),
          durationDays: Number(r.duration_days),
          description: r.description,
          isActive: r.is_active,
          color: r.color,
          features: typeof r.features === 'string' ? JSON.parse(r.features) : r.features || [],
        }));
      }
    } catch (err) {
      console.warn('[Neon DB] getAllPackages fallback:', err);
    }
  }
  return inMemoryPackages;
}

export async function createInvestmentPackage(pkg: InvestmentPackage): Promise<InvestmentPackage> {
  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO packages (id, name, tag, price_kes, daily_roi_percent, duration_days, description, is_active, color, features)
        VALUES (${pkg.id}, ${pkg.name}, ${pkg.tag || ''}, ${pkg.priceKES}, ${pkg.dailyRoiPercent}, ${pkg.durationDays}, ${pkg.description || ''}, ${pkg.isActive}, ${pkg.color || ''}, ${JSON.stringify(pkg.features || [])});
      `;
    } catch (err) {
      console.warn('[Neon DB] createInvestmentPackage DB error:', err);
    }
  }
  inMemoryPackages.push(pkg);
  return pkg;
}

export async function updateInvestmentPackage(idOrPkg: string | InvestmentPackage, maybePkg?: Partial<InvestmentPackage>): Promise<InvestmentPackage> {
  let pkg: InvestmentPackage;
  if (typeof idOrPkg === 'string') {
    const existing = inMemoryPackages.find(p => p.id === idOrPkg) || initialPackages.find(p => p.id === idOrPkg);
    pkg = { ...existing!, ...(maybePkg || {}), id: idOrPkg };
  } else {
    pkg = idOrPkg;
  }
  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`
        UPDATE packages SET
          name = ${pkg.name},
          tag = ${pkg.tag || ''},
          price_kes = ${pkg.priceKES},
          daily_roi_percent = ${pkg.dailyRoiPercent},
          duration_days = ${pkg.durationDays},
          description = ${pkg.description || ''},
          is_active = ${pkg.isActive},
          color = ${pkg.color || ''},
          features = ${JSON.stringify(pkg.features || [])}
        WHERE id = ${pkg.id};
      `;
    } catch (err) {
      console.warn('[Neon DB] updateInvestmentPackage DB error:', err);
    }
  }
  const idx = inMemoryPackages.findIndex(p => p.id === pkg.id);
  if (idx >= 0) inMemoryPackages[idx] = pkg;
  return pkg;
}

export async function deleteInvestmentPackage(id: string): Promise<boolean> {
  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`DELETE FROM packages WHERE id = ${id};`;
    } catch (err) {
      console.warn('[Neon DB] deleteInvestmentPackage DB error:', err);
    }
  }
  inMemoryPackages = inMemoryPackages.filter(p => p.id !== id);
  return true;
}

export async function resetInvestmentPackages(): Promise<InvestmentPackage[]> {
  inMemoryPackages = [...initialPackages];
  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`DELETE FROM packages;`;
      for (const p of initialPackages) {
        await sql`
          INSERT INTO packages (id, name, tag, price_kes, daily_roi_percent, duration_days, description, is_active, color, features)
          VALUES (${p.id}, ${p.name}, ${p.tag || ''}, ${p.priceKES}, ${p.dailyRoiPercent}, ${p.durationDays}, ${p.description}, ${p.isActive}, ${p.color}, ${JSON.stringify(p.features)});
        `;
      }
    } catch (err) {
      console.warn('[Neon DB] resetInvestmentPackages DB error:', err);
    }
  }
  return inMemoryPackages;
}

// Investments
export async function getUserInvestments(userId: string): Promise<ActiveInvestment[]> {
  const sql = getNeonSql();
  if (sql) {
    try {
      const rows: any[] = await sql`SELECT * FROM investments WHERE user_id = ${userId} ORDER BY created_at DESC;`;
      return rows.map((r: any) => ({
        id: r.id,
        packageId: r.package_id,
        packageName: r.package_name,
        amountKES: Number(r.amount_kes),
        dailyRoiPercent: Number(r.daily_roi_percent),
        dailyReturnKES: Number(r.daily_return_kes),
        durationDays: Number(r.duration_days),
        daysElapsed: Number(r.days_elapsed || 0),
        totalEarnedKES: Number(r.total_earned_kes || 0),
        unclaimedYieldKES: Number(r.unclaimed_yield_kes || 0),
        status: r.status,
        startDate: r.start_date,
        lastClaimDate: r.last_claim_date,
      }));
    } catch (err) {
      console.warn('[Neon DB] getUserInvestments fallback:', err);
    }
  }
  return inMemoryInvestments.filter(i => (i as any).userId === userId || userId === 'usr-98214');
}

export async function createInvestment(userId: string, inv: ActiveInvestment): Promise<ActiveInvestment> {
  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO investments (
          id, user_id, package_id, package_name, amount_kes, daily_roi_percent,
          daily_return_kes, duration_days, days_elapsed, total_earned_kes, unclaimed_yield_kes,
          status, start_date, last_claim_date
        ) VALUES (
          ${inv.id}, ${userId}, ${inv.packageId}, ${inv.packageName}, ${inv.amountKES},
          ${inv.dailyRoiPercent}, ${inv.dailyReturnKES}, ${inv.durationDays}, ${inv.daysElapsed || 0},
          ${inv.totalEarnedKES || 0}, ${inv.unclaimedYieldKES || 0}, ${inv.status}, ${inv.startDate},
          ${inv.lastClaimDate || null}
        );
      `;
    } catch (err) {
      console.warn('[Neon DB] createInvestment DB error:', err);
    }
  }
  const full = { ...inv, userId };
  inMemoryInvestments.unshift(full);
  return full;
}

// Transactions
export async function getUserTransactions(userId: string): Promise<Transaction[]> {
  const sql = getNeonSql();
  if (sql) {
    try {
      const rows: any[] = await sql`SELECT * FROM transactions WHERE user_id = ${userId} ORDER BY created_at DESC;`;
      return rows.map((r: any) => ({
        id: r.id,
        type: r.type,
        amountKES: Number(r.amount_kes),
        description: r.description,
        date: r.date_str,
        status: r.status,
        reference: r.reference || r.reference_code || '',
        destination: r.destination,
      }));
    } catch (err) {
      console.warn('[Neon DB] getUserTransactions fallback:', err);
    }
  }
  return inMemoryTransactions;
}

export async function createTransaction(userId: string, tx: Transaction): Promise<Transaction> {
  const sql = getNeonSql();
  if (sql) {
    try {
      const refVal = tx.reference || (tx as any).referenceCode || null;
      await sql`
        INSERT INTO transactions (id, user_id, type, amount_kes, description, date_str, status, reference, reference_code, destination)
        VALUES (${tx.id}, ${userId}, ${tx.type}, ${tx.amountKES}, ${tx.description}, ${tx.date}, ${tx.status}, ${refVal}, ${refVal}, ${tx.destination || null});
      `;
    } catch (err) {
      console.warn('[Neon DB] createTransaction DB error:', err);
    }
  }
  inMemoryTransactions.unshift(tx);
  return tx;
}

// Withdrawals
export async function getUserWithdrawals(userId?: string): Promise<WithdrawalRequest[]> {
  const sql = getNeonSql();
  if (sql) {
    try {
      const rows: any[] = userId
        ? await sql`SELECT * FROM withdrawals WHERE user_id = ${userId} ORDER BY created_at DESC;`
        : await sql`SELECT * FROM withdrawals ORDER BY created_at DESC;`;
      return rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name || 'Investor',
        amountKES: Number(r.amount_kes),
        feeKES: Number(r.fee_kes || 0),
        netAmountKES: Number(r.net_amount_kes || r.amount_kes),
        method: r.method,
        destination: r.destination,
        accountName: r.account_name,
        status: r.status,
        createdAt: r.created_at_str,
        estimatedDelivery: r.estimated_delivery,
        txHashOrRef: r.tx_hash_or_ref,
        rejectionReason: r.rejection_reason,
      }));
    } catch (err) {
      console.warn('[Neon DB] getUserWithdrawals fallback:', err);
    }
  }
  return userId ? inMemoryWithdrawals.filter(w => w.userId === userId) : inMemoryWithdrawals;
}

export async function createWithdrawal(firstArg: string | WithdrawalRequest, maybeW?: WithdrawalRequest): Promise<WithdrawalRequest> {
  const w = typeof firstArg === 'string' ? maybeW! : firstArg;
  const userId = typeof firstArg === 'string' ? firstArg : (w as any).userId || 'usr-default';
  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO withdrawals (
          id, user_id, user_name, amount_kes, fee_kes, net_amount_kes, method, destination, account_name,
          status, created_at_str, estimated_delivery, tx_hash_or_ref, rejection_reason
        ) VALUES (
          ${w.id}, ${userId}, ${w.userName || 'Investor'}, ${w.amountKES}, ${w.feeKES || 0}, ${w.netAmountKES || w.amountKES},
          ${w.method}, ${w.destination}, ${w.accountName || null}, ${w.status}, ${w.createdAt},
          ${w.estimatedDelivery || '1 hour'}, ${w.txHashOrRef || null}, ${w.rejectionReason || null}
        );
      `;
    } catch (err) {
      console.warn('[Neon DB] createWithdrawal DB error:', err);
    }
  }
  const full = { ...w, userId };
  inMemoryWithdrawals.unshift(full);
  return full;
}

export async function updateWithdrawalStatus(
  id: string, 
  status: 'pending' | 'processing' | 'completed' | 'rejected', 
  detailsOrTxHash?: string | { txHash?: string; rejectionReason?: string },
  rejectionReasonArg?: string
): Promise<void> {
  let txHash: string | undefined;
  let rejectionReason: string | undefined;

  if (typeof detailsOrTxHash === 'string') {
    txHash = detailsOrTxHash;
    rejectionReason = rejectionReasonArg;
  } else if (detailsOrTxHash && typeof detailsOrTxHash === 'object') {
    txHash = detailsOrTxHash.txHash;
    rejectionReason = detailsOrTxHash.rejectionReason;
  }

  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`
        UPDATE withdrawals SET
          status = ${status},
          tx_hash_or_ref = ${txHash || null},
          rejection_reason = ${rejectionReason || null}
        WHERE id = ${id};
      `;
    } catch (err) {
      console.warn('[Neon DB] updateWithdrawalStatus DB error:', err);
    }
  }
  const item = inMemoryWithdrawals.find(w => w.id === id);
  if (item) {
    item.status = status;
    if (txHash) item.txHashOrRef = txHash;
    if (rejectionReason) item.rejectionReason = rejectionReason;
  }
}

// Referrals
export async function getUserReferrals(userId?: string): Promise<ReferralMember[]> {
  const sql = getNeonSql();
  if (sql) {
    try {
      const rows: any[] = userId 
        ? await sql`
            SELECT r.*, u.phone as u_phone, u.email as u_email, u.created_at as u_created_at
            FROM referrals r
            LEFT JOIN users u ON (u.phone = r.phone_or_email OR u.email = r.phone_or_email OR u.name = r.name)
            WHERE r.referred_by = ${userId}
            ORDER BY r.created_at DESC;
          `
        : await sql`
            SELECT r.*, u.phone as u_phone, u.email as u_email, u.created_at as u_created_at
            FROM referrals r
            LEFT JOIN users u ON (u.phone = r.phone_or_email OR u.email = r.phone_or_email OR u.name = r.name)
            ORDER BY r.created_at DESC;
          `;
      return rows.map((r: any) => {
        const phone = r.phone || r.u_phone || (r.phone_or_email && !r.phone_or_email.includes('@') ? r.phone_or_email : undefined);
        const email = r.email || r.u_email || (r.phone_or_email && r.phone_or_email.includes('@') ? r.phone_or_email : undefined);
        return {
          id: r.id,
          name: r.name,
          phoneOrEmail: r.phone_or_email || phone || email || '',
          phone,
          email,
          tier: r.tier || 1,
          referredBy: r.referred_by,
          joinedDate: r.joined_date || (r.created_at ? new Date(r.created_at).toISOString().substring(0, 10) : '2026-09-18'),
          registeredAt: r.registered_at || (r.created_at ? new Date(r.created_at).toLocaleString() : undefined),
          totalDepositedKES: Number(r.total_deposited_kes || 0),
          commissionEarnedKES: Number(r.commission_earned_kes || 0),
          packageActive: r.package_active || (Number(r.total_deposited_kes || 0) > 0 ? 'Active Investor' : 'Pending First Recharge'),
          status: r.status || 'active',
          isQualifying: Number(r.total_deposited_kes || 0) > 0,
          lastContactedDate: r.last_contacted_date,
          reminderCount: r.reminder_count ? Number(r.reminder_count) : 0,
        };
      });
    } catch (err) {
      console.warn('[Neon DB] getUserReferrals fallback:', err);
    }
  }

  const list = userId ? inMemoryReferrals.filter(r => r.referredBy === userId) : inMemoryReferrals;
  return list.map(r => {
    // Fill phone and email if missing
    let phone = r.phone;
    let email = r.email;
    if (!phone && r.phoneOrEmail && !r.phoneOrEmail.includes('@')) {
      phone = r.phoneOrEmail;
    }
    if (!email && r.phoneOrEmail && r.phoneOrEmail.includes('@')) {
      email = r.phoneOrEmail;
    }
    return {
      ...r,
      phone,
      email,
      registeredAt: r.registeredAt || `${r.joinedDate} 12:00`,
      packageActive: r.packageActive || (r.totalDepositedKES > 0 ? 'Active Investor' : 'Pending First Recharge'),
      isQualifying: r.totalDepositedKES > 0,
    };
  });
}

export async function findUserByReferralCode(referralCode: string): Promise<UserProfile | null> {
  if (!referralCode) return null;
  const clean = referralCode.trim().toUpperCase();
  const sql = getNeonSql();
  if (sql) {
    try {
      const rows: any[] = await sql`SELECT * FROM users WHERE UPPER(referral_code) = ${clean} LIMIT 1;`;
      if (rows && rows.length > 0) return mapUserRow(rows[0]);
    } catch (err) {
      console.warn('[Neon DB] findUserByReferralCode fallback:', err);
    }
  }
  for (const u of inMemoryUsers.values()) {
    if (u.referralCode?.trim().toUpperCase() === clean) {
      return mapUserRow(u);
    }
  }
  return null;
}

export async function insertReferralMember(member: ReferralMember): Promise<ReferralMember> {
  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO referrals (
          id, name, phone_or_email, phone, email, tier, referred_by, joined_date, registered_at,
          total_deposited_kes, commission_earned_kes, package_active, status, last_contacted_date, reminder_count
        ) VALUES (
          ${member.id}, ${member.name}, ${member.phoneOrEmail}, ${member.phone || null}, ${member.email || null},
          ${member.tier}, ${member.referredBy}, ${member.joinedDate}, ${member.registeredAt || null},
          ${member.totalDepositedKES}, ${member.commissionEarnedKES},
          ${member.packageActive}, ${member.status}, ${member.lastContactedDate || null}, ${member.reminderCount || 0}
        ) ON CONFLICT (id) DO UPDATE SET
          total_deposited_kes = EXCLUDED.total_deposited_kes,
          commission_earned_kes = EXCLUDED.commission_earned_kes,
          package_active = EXCLUDED.package_active,
          phone = COALESCE(EXCLUDED.phone, referrals.phone),
          email = COALESCE(EXCLUDED.email, referrals.email),
          registered_at = COALESCE(EXCLUDED.registered_at, referrals.registered_at),
          last_contacted_date = COALESCE(EXCLUDED.last_contacted_date, referrals.last_contacted_date),
          reminder_count = COALESCE(EXCLUDED.reminder_count, referrals.reminder_count),
          status = EXCLUDED.status;
      `;
    } catch (err) {
      console.warn('[Neon DB] insertReferralMember DB fallback:', err);
    }
  }
  const existingIdx = inMemoryReferrals.findIndex(r => r.id === member.id);
  if (existingIdx >= 0) {
    inMemoryReferrals[existingIdx] = member;
  } else {
    inMemoryReferrals.push(member);
  }
  return member;
}

export async function recordReferralContactReminder(memberId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`
        UPDATE referrals 
        SET last_contacted_date = ${now}, reminder_count = COALESCE(reminder_count, 0) + 1
        WHERE id = ${memberId};
      `;
    } catch (err) {
      console.warn('[Neon DB] recordReferralContactReminder DB fallback:', err);
    }
  }
  const ref = inMemoryReferrals.find(r => r.id === memberId);
  if (ref) {
    ref.lastContactedDate = now;
    ref.reminderCount = (ref.reminderCount || 0) + 1;
    return true;
  }
  return true;
}

// -------------------------------------------------------------
// PENDING COMMISSIONS (10% on Friend Deposits with 72h Vesting)
// -------------------------------------------------------------

export async function createPendingCommission(comm: PendingCommission): Promise<PendingCommission> {
  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO pending_commissions (
          id, user_id, from_user_id, from_user_name, deposit_amount_kes,
          commission_amount_kes, commission_percent, status, unlock_at,
          is_unlocked, created_at, risk_score, flag_reason
        ) VALUES (
          ${comm.id}, ${comm.userId}, ${comm.fromUserId}, ${comm.fromUserName},
          ${comm.depositAmountKES}, ${comm.commissionAmountKES}, ${comm.commissionPercent},
          ${comm.status}, ${comm.unlockAt}, ${comm.isUnlocked}, ${comm.createdAt},
          ${comm.riskScore || 0}, ${comm.flagReason || null}
        );
      `;
    } catch (err) {
      console.warn('[Neon DB] createPendingCommission DB warning:', err);
    }
  }
  inMemoryPendingCommissions.push(comm);
  return comm;
}

export async function getPendingCommissions(userId?: string): Promise<PendingCommission[]> {
  const sql = getNeonSql();
  if (sql) {
    try {
      const rows: any[] = userId
        ? await sql`SELECT * FROM pending_commissions WHERE user_id = ${userId} ORDER BY created_at DESC;`
        : await sql`SELECT * FROM pending_commissions ORDER BY created_at DESC;`;
      return rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        fromUserId: r.from_user_id,
        fromUserName: r.from_user_name,
        depositAmountKES: Number(r.deposit_amount_kes || 0),
        commissionAmountKES: Number(r.commission_amount_kes || 0),
        commissionPercent: Number(r.commission_percent || 10),
        status: r.status,
        createdAt: r.created_at,
        unlockAt: r.unlock_at,
        isUnlocked: Boolean(r.is_unlocked),
        unlockedAt: r.unlocked_at || undefined,
        riskScore: Number(r.risk_score || 0),
        flagReason: r.flag_reason || undefined,
      }));
    } catch (err) {
      console.warn('[Neon DB] getPendingCommissions fallback:', err);
    }
  }
  return userId
    ? inMemoryPendingCommissions.filter(c => c.userId === userId)
    : inMemoryPendingCommissions;
}

export async function releaseMaturedCommissions(): Promise<{ releasedCount: number; releasedAmountKES: number }> {
  const now = new Date();
  let releasedCount = 0;
  let releasedAmountKES = 0;

  // 1. Process in-memory store
  for (const c of inMemoryPendingCommissions) {
    if (c.status === 'pending' && !c.isUnlocked && new Date(c.unlockAt) <= now) {
      c.status = 'matured';
      c.isUnlocked = true;
      c.unlockedAt = now.toISOString();
      releasedCount++;
      releasedAmountKES += c.commissionAmountKES;

      // Credit user normal account balance
      const user = inMemoryUsers.get(c.userId);
      if (user) {
        user.walletBalanceKES = (user.walletBalanceKES || 0) + c.commissionAmountKES;
        user.totalReferralBonusKES = (user.totalReferralBonusKES || 0) + c.commissionAmountKES;
      }

      // Record transaction
      const tx: Transaction = {
        id: `tx-comm-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        type: 'referral_bonus',
        amountKES: c.commissionAmountKES,
        description: `10% Referral Commission (From ${c.fromUserName}, 72h Vesting Complete)`,
        date: now.toISOString().replace('T', ' ').substring(0, 16),
        status: 'completed',
        reference: `COMM-72H-${c.id.slice(-6)}`,
      };
      inMemoryTransactions.unshift(tx);

      // Anti-fraud audit log
      logAntiFraudEvent({
        id: `afe-${Date.now()}-${Math.random().toString(36).substring(2, 4)}`,
        eventType: 'COMMISSION_MATURED_RELEASED',
        userId: c.userId,
        userIdentifier: c.userId,
        riskScore: 0,
        severity: 'low',
        actionTaken: 'RESOLVED',
        details: `10% referral commission (KES ${c.commissionAmountKES.toLocaleString()}) matured after 72-hour fraud protection window and was released to normal wallet balance.`,
        createdAt: now.toISOString(),
      }).catch(() => {});
    }
  }

  // 2. Process Neon PostgreSQL store
  const sql = getNeonSql();
  if (sql) {
    try {
      const matureRows: any[] = await sql`
        SELECT * FROM pending_commissions 
        WHERE status = 'pending' AND is_unlocked = FALSE AND unlock_at <= NOW();
      `;

      for (const row of matureRows) {
        const commAmt = Number(row.commission_amount_kes);
        await sql`
          UPDATE pending_commissions 
          SET status = 'matured', is_unlocked = TRUE, unlocked_at = NOW() 
          WHERE id = ${row.id};
        `;
        await sql`
          UPDATE users 
          SET wallet_balance_kes = wallet_balance_kes + ${commAmt},
              total_referral_bonus_kes = total_referral_bonus_kes + ${commAmt}
          WHERE id = ${row.user_id};
        `;
        await sql`
          INSERT INTO transactions (
            id, user_id, type, amount_kes, description, date, status, reference
          ) VALUES (
            ${`tx-comm-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`},
            ${row.user_id}, 'referral_bonus', ${commAmt},
            ${`10% Referral Commission (From ${row.from_user_name || 'Invited Friend'}, 72h Vesting Complete)`},
            NOW(), 'completed', ${`COMM-72H-${row.id.slice(-6)}`}
          );
        `;
      }
    } catch (err) {
      console.warn('[Neon DB] releaseMaturedCommissions DB error:', err);
    }
  }

  return { releasedCount, releasedAmountKES };
}

// -------------------------------------------------------------
// ROYAL WEEKLY SALARY CAMPAIGN (Sunday Automated Disbursements)
// -------------------------------------------------------------

export async function updateUserSalaryConfig(userId: string, config: UserSalaryConfig): Promise<UserSalaryConfig> {
  const cleanConfig: UserSalaryConfig = {
    method: config.method || 'mpesa',
    destination: (config.destination || '').trim(),
    accountName: config.accountName || undefined,
    isAutoDisburse: config.isAutoDisburse !== false,
    lastUpdated: new Date().toISOString(),
  };

  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`
        UPDATE users 
        SET salary_config = ${JSON.stringify(cleanConfig)} 
        WHERE id = ${userId};
      `;
    } catch (err) {
      console.warn('[Neon DB] updateUserSalaryConfig DB error:', err);
    }
  }

  const u = inMemoryUsers.get(userId);
  if (u) {
    u.salaryConfig = cleanConfig;
  }
  return cleanConfig;
}

export async function getWeeklySalaryPayouts(userId?: string): Promise<WeeklySalaryPayout[]> {
  const sql = getNeonSql();
  if (sql) {
    try {
      const rows: any[] = userId
        ? await sql`SELECT * FROM weekly_salary_payouts WHERE user_id = ${userId} ORDER BY created_at DESC;`
        : await sql`SELECT * FROM weekly_salary_payouts ORDER BY created_at DESC;`;
      return rows.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name || 'Partner',
        weekEndingDate: r.week_ending_date,
        qualifyingReferrals: Number(r.qualifying_referrals || 0),
        amountKES: Number(r.amount_kes || 0),
        method: r.method,
        destination: r.destination,
        status: r.status,
        txHashOrRef: r.tx_hash_or_ref,
        createdAt: r.created_at,
      }));
    } catch (err) {
      console.warn('[Neon DB] getWeeklySalaryPayouts DB error:', err);
    }
  }
  return userId
    ? inMemoryWeeklySalaryPayouts.filter(p => p.userId === userId)
    : inMemoryWeeklySalaryPayouts;
}

export async function recordWeeklySalaryPayout(payout: WeeklySalaryPayout): Promise<WeeklySalaryPayout> {
  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO weekly_salary_payouts (
          id, user_id, user_name, week_ending_date, qualifying_referrals,
          amount_kes, method, destination, status, tx_hash_or_ref, created_at
        ) VALUES (
          ${payout.id}, ${payout.userId}, ${payout.userName}, ${payout.weekEndingDate},
          ${payout.qualifyingReferrals}, ${payout.amountKES}, ${payout.method},
          ${payout.destination}, ${payout.status}, ${payout.txHashOrRef || null},
          ${payout.createdAt}
        );
      `;
    } catch (err) {
      console.warn('[Neon DB] recordWeeklySalaryPayout DB error:', err);
    }
  }
  inMemoryWeeklySalaryPayouts.unshift(payout);
  return payout;
}

export function getNextSundayInfo(): { sundayDateStr: string; countdownSeconds: number; formattedSundayDate: string } {
  const now = new Date();
  const currentDay = now.getUTCDay(); // 0 = Sunday
  const daysUntilSunday = currentDay === 0 ? 0 : 7 - currentDay;

  const targetSunday = new Date(now);
  targetSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);
  targetSunday.setUTCHours(23, 59, 59, 999);

  const diffMs = Math.max(0, targetSunday.getTime() - now.getTime());
  const countdownSeconds = Math.floor(diffMs / 1000);
  const sundayDateStr = targetSunday.toISOString().substring(0, 10);
  
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' };
  const formattedSundayDate = targetSunday.toLocaleDateString('en-US', options);

  return { sundayDateStr, countdownSeconds, formattedSundayDate };
}

export function resolveSalaryTier(qualifyingReferrals: number): {
  currentTier: WeeklySalaryTier | null;
  nextTier: WeeklySalaryTier | null;
  salaryKES: number;
} {
  let currentTier: WeeklySalaryTier | null = null;
  let nextTier: WeeklySalaryTier | null = WEEKLY_SALARY_TIERS[0];
  let salaryKES = 0;

  for (let i = 0; i < WEEKLY_SALARY_TIERS.length; i++) {
    const tier = WEEKLY_SALARY_TIERS[i];
    if (qualifyingReferrals >= tier.minReferrals) {
      currentTier = tier;
      salaryKES = tier.weeklySalaryKES;
      nextTier = WEEKLY_SALARY_TIERS[i + 1] || null;
    }
  }

  return { currentTier, nextTier, salaryKES };
}

export async function calculateUserCampaignStats(userId: string, hostOrigin?: string): Promise<CampaignOverview> {
  const user = await findUserById(userId);
  if (!user) throw new Error('User not found');

  const referrals = await getUserReferrals(userId);
  const totalReferralsCount = referrals.length;

  // Strict anti-fraud qualifying check:
  // Qualifying referral = active referral with actual deposited capital or active package
  const qualifyingReferrals = referrals.filter(r => 
    r.status === 'active' && (r.totalDepositedKES > 0 || (r.packageActive && r.packageActive !== 'None' && r.packageActive !== 'Pending Deposit'))
  );
  const qualifyingReferralsCount = qualifyingReferrals.length;

  const { currentTier, nextTier, salaryKES } = resolveSalaryTier(qualifyingReferralsCount);
  const { sundayDateStr, countdownSeconds } = getNextSundayInfo();

  // Get user's pending 72h commissions
  const allUserCommissions = await getPendingCommissions(userId);
  const pendingCommissionsList = allUserCommissions.filter(c => c.status === 'pending' && !c.isUnlocked);
  const pendingCommissionsTotalKES = pendingCommissionsList.reduce((acc, c) => acc + c.commissionAmountKES, 0);

  // Default salary config if not yet set: defaults to M-Pesa with user's phone
  const salaryConfig: UserSalaryConfig = user.salaryConfig || {
    method: 'mpesa',
    destination: user.phone || '',
    isAutoDisburse: true,
  };

  const pastSalaryPayouts = await getWeeklySalaryPayouts(userId);

  // Dynamically constructed invite URL based on the current host environment
  const dynamicOrigin = hostOrigin ? hostOrigin.replace(/\/$/, '') : 'https://royalservice.ke';
  const dynamicInviteUrl = `${dynamicOrigin}?ref=${user.referralCode}`;

  return {
    userReferralCode: user.referralCode,
    dynamicInviteUrl,
    totalReferralsCount,
    qualifyingReferralsCount,
    currentSalaryTier: currentTier,
    nextSalaryTier: nextTier,
    pendingSalaryKES: salaryKES,
    nextSundayDate: sundayDateStr,
    nextSundayCountdownSeconds: countdownSeconds,
    pendingCommissionsTotalKES,
    pendingCommissionsList,
    salaryConfig,
    pastSalaryPayouts,
  };
}

// -------------------------------------------------------------
// REFERRAL DEPOSIT REWARD (10% 72-Hour Anti-Fraud Shield)
// -------------------------------------------------------------

export async function processReferralDepositReward(
  depositorId: string, 
  depositAmountKES: number, 
  clientIp?: string, 
  reference?: string
): Promise<{ success: boolean; commission?: PendingCommission; message: string }> {
  if (depositAmountKES <= 0) return { success: false, message: 'Invalid deposit amount' };

  const depositor = await findUserById(depositorId);
  if (!depositor || !depositor.referredByCode) {
    return { success: false, message: 'No referral code associated with depositor' };
  }

  const referrer = await findUserByReferralCode(depositor.referredByCode);
  if (!referrer) {
    return { success: false, message: 'Referrer not found' };
  }

  // ========================================================
  // STRICT ANTI-FRAUD AND ANTI-SYBIL DETECTION SYSTEM
  // ========================================================

  // 1. Self-Referral Prevention (Same ID)
  if (referrer.id === depositor.id) {
    await logAntiFraudEvent({
      id: `afe-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      eventType: 'SELF_REFERRAL_ATTEMPT',
      userId: referrer.id,
      userIdentifier: `${referrer.name} (${referrer.phone})`,
      riskScore: 90,
      severity: 'high',
      actionTaken: 'BLOCKED',
      details: `Self-referral deposit blocked: User ${referrer.name} deposited on their own account using their own referral code ${depositor.referredByCode}.`,
      ipAddress: clientIp,
      createdAt: new Date().toISOString(),
    });
    return { success: false, message: 'Self-referrals are strictly prohibited by Anti-Fraud rules.' };
  }

  // 2. Phone Number Sybil Collision Check
  const cleanPhoneRef = (referrer.phone || '').replace(/[^0-9]/g, '');
  const cleanPhoneDep = (depositor.phone || '').replace(/[^0-9]/g, '');
  if (cleanPhoneRef && cleanPhoneDep && (cleanPhoneRef.endsWith(cleanPhoneDep.slice(-7)) || cleanPhoneDep.endsWith(cleanPhoneRef.slice(-7)))) {
    await logAntiFraudEvent({
      id: `afe-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      eventType: 'SELF_REFERRAL_ATTEMPT',
      userId: referrer.id,
      userIdentifier: `${referrer.name} (${referrer.phone})`,
      riskScore: 85,
      severity: 'high',
      actionTaken: 'BLOCKED',
      details: `Sybil phone collision blocked: Depositor phone (${depositor.phone}) matches Referrer phone (${referrer.phone}). Commission canceled.`,
      ipAddress: clientIp,
      createdAt: new Date().toISOString(),
    });
    return { success: false, message: 'Matching telephone identity between sponsor and invitee.' };
  }

  // 3. Email Identity Collision Check
  if (referrer.email && depositor.email && referrer.email.trim().toLowerCase() === depositor.email.trim().toLowerCase()) {
    await logAntiFraudEvent({
      id: `afe-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      eventType: 'SELF_REFERRAL_ATTEMPT',
      userId: referrer.id,
      userIdentifier: `${referrer.name} (${referrer.email})`,
      riskScore: 85,
      severity: 'high',
      actionTaken: 'BLOCKED',
      details: `Sybil email collision blocked: Depositor email (${depositor.email}) matches Referrer email (${referrer.email}). Commission canceled.`,
      ipAddress: clientIp,
      createdAt: new Date().toISOString(),
    });
    return { success: false, message: 'Identical email account between sponsor and invitee.' };
  }

  // 4. Circular Affiliate Ring Check (A invites B, B invites A)
  if (referrer.referredByCode && depositor.referralCode && referrer.referredByCode.trim().toUpperCase() === depositor.referralCode.trim().toUpperCase()) {
    await logAntiFraudEvent({
      id: `afe-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      eventType: 'COLLUSIVE_AFFILIATE_RING',
      userId: referrer.id,
      userIdentifier: `${referrer.name} <-> ${depositor.name}`,
      riskScore: 80,
      severity: 'high',
      actionTaken: 'FLAGGED_FOR_REVIEW',
      details: `Circular affiliate loop detected between ${referrer.name} and ${depositor.name}. Referral commissions withheld pending compliance review.`,
      ipAddress: clientIp,
      createdAt: new Date().toISOString(),
    });
    return { success: false, message: 'Circular referral loop flagged by compliance system.' };
  }

  // 5. Calculate 10% Commission
  const commissionPercent = 10.0;
  const commissionAmountKES = Math.round(depositAmountKES * (commissionPercent / 100) * 100) / 100;

  // 6. Set 72-Hour Vesting Unlock Date
  const now = new Date();
  const unlockDate = new Date(now.getTime() + 72 * 60 * 60 * 1000); // exactly 72 hours
  const unlockAt = unlockDate.toISOString();

  const pendingComm: PendingCommission = {
    id: `comm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    userId: referrer.id,
    fromUserId: depositor.id,
    fromUserName: depositor.name,
    depositAmountKES,
    commissionAmountKES,
    commissionPercent,
    status: 'pending',
    createdAt: now.toISOString(),
    unlockAt,
    isUnlocked: false,
    riskScore: 5,
  };

  await createPendingCommission(pendingComm);

  // 7. Update or insert referral tracking row for this invitee
  const existingReferrals = await getUserReferrals(referrer.id);
  const existingRef = existingReferrals.find(r => 
    r.name.toLowerCase() === depositor.name.toLowerCase() || 
    (depositor.phone && r.phoneOrEmail.includes(depositor.phone.slice(-7)))
  );

  if (existingRef) {
    existingRef.totalDepositedKES += depositAmountKES;
    existingRef.commissionEarnedKES += commissionAmountKES;
    existingRef.status = 'active';
    await insertReferralMember(existingRef);
  } else {
    const newRefMember: ReferralMember = {
      id: `ref-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: depositor.name,
      phoneOrEmail: depositor.phone || depositor.email,
      tier: 1,
      referredBy: referrer.id,
      joinedDate: now.toISOString().substring(0, 10),
      totalDepositedKES: depositAmountKES,
      commissionEarnedKES: commissionAmountKES,
      packageActive: 'Active Investor',
      status: 'active',
      isQualifying: true,
    };
    await insertReferralMember(newRefMember);
  }

  // 8. Log Anti-Fraud Audit Trail
  await logAntiFraudEvent({
    id: `afe-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    eventType: 'COMMISSION_QUEUED_72H_SHIELD',
    userId: referrer.id,
    userIdentifier: `${referrer.name} (${referrer.phone})`,
    riskScore: 5,
    severity: 'low',
    actionTaken: 'FLAGGED_FOR_REVIEW',
    details: `10% referral commission (KES ${commissionAmountKES.toLocaleString()}) queued from ${depositor.name}'s deposit of KES ${depositAmountKES.toLocaleString()}. Vests automatically in 72 hours (Unlock: ${unlockDate.toUTCString()}). Ref: ${reference || 'N/A'}.`,
    ipAddress: clientIp,
    createdAt: now.toISOString(),
  });

  return { 
    success: true, 
    commission: pendingComm, 
    message: `10% referral commission of KES ${commissionAmountKES.toLocaleString()} queued with 72-hour fraud protection.` 
  };
}

// -------------------------------------------------------------
// AUTOMATED SUNDAY SALARY DISBURSEMENTS ENGINE
// -------------------------------------------------------------

export async function processSundaySalaryDisbursements(forceSunday = false): Promise<{
  disbursedCount: number;
  totalDisbursedKES: number;
  payouts: WeeklySalaryPayout[];
}> {
  const now = new Date();
  const isSunday = now.getUTCDay() === 0 || forceSunday;
  if (!isSunday) {
    return { disbursedCount: 0, totalDisbursedKES: 0, payouts: [] };
  }

  const { sundayDateStr } = getNextSundayInfo();
  // If running on Sunday itself, weekEndingDate is today's Sunday
  const weekEndingDate = now.getUTCDay() === 0 ? now.toISOString().substring(0, 10) : sundayDateStr;

  const allUsers = await listAllUsers();
  const payouts: WeeklySalaryPayout[] = [];
  let disbursedCount = 0;
  let totalDisbursedKES = 0;

  for (const user of allUsers) {
    if (user.isFrozen) continue;

    // Get qualifying active referrals
    const referrals = await getUserReferrals(user.id);
    const qualifyingReferrals = referrals.filter(r => 
      r.status === 'active' && (r.totalDepositedKES > 0 || (r.packageActive && r.packageActive !== 'None' && r.packageActive !== 'Pending Deposit'))
    );
    const qualifyingCount = qualifyingReferrals.length;

    if (qualifyingCount < 10) continue;

    const { currentTier, salaryKES } = resolveSalaryTier(qualifyingCount);
    if (!currentTier || salaryKES <= 0) continue;

    // Check if user has already been paid for this weekEndingDate
    const existingPayouts = await getWeeklySalaryPayouts(user.id);
    const alreadyPaid = existingPayouts.some(p => p.weekEndingDate === weekEndingDate && p.status === 'completed');
    if (alreadyPaid) continue;

    // Resolve destination configured by user on the invitation page
    const config = user.salaryConfig || {
      method: 'mpesa',
      destination: user.phone,
      isAutoDisburse: true,
    };

    const method = config.method || 'mpesa';
    const destination = (config.destination || user.phone || '').trim();

    if (!destination) continue;

    // Anti-Fraud: Destination address collision check
    // Ensure destination does not belong to any of their downline referrals
    const matchingDownline = referrals.find(r => r.phoneOrEmail && r.phoneOrEmail.includes(destination.slice(-7)));
    if (matchingDownline && method === 'mpesa') {
      await logAntiFraudEvent({
        id: `afe-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        eventType: 'COLLUSIVE_AFFILIATE_RING',
        userId: user.id,
        userIdentifier: `${user.name} (${user.phone})`,
        riskScore: 75,
        severity: 'high',
        actionTaken: 'FLAGGED_FOR_REVIEW',
        details: `Weekly salary disbursement paused: Salary destination phone (${destination}) matches downline referral (${matchingDownline.name}). Flagged for review.`,
        createdAt: now.toISOString(),
      });
      continue;
    }

    const payoutRecord: WeeklySalaryPayout = {
      id: `sal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: user.id,
      userName: user.name,
      weekEndingDate,
      qualifyingReferrals: qualifyingCount,
      amountKES: salaryKES,
      method,
      destination,
      status: 'completed',
      txHashOrRef: `ROYAL-SAL-${Date.now().toString().slice(-6)}`,
      createdAt: now.toISOString(),
    };

    await recordWeeklySalaryPayout(payoutRecord);
    payouts.push(payoutRecord);
    disbursedCount++;
    totalDisbursedKES += salaryKES;

    // Record formal transaction in audit ledger
    await createTransaction(user.id, {
      id: `tx-sal-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      type: 'referral_bonus',
      amountKES: salaryKES,
      description: `👑 Royal Weekly Salary Payout (${currentTier.tierName} Tier, ${qualifyingCount} Partners - Sent to ${destination})`,
      date: now.toISOString().replace('T', ' ').substring(0, 16),
      status: 'completed',
      reference: payoutRecord.txHashOrRef || `SAL-${weekEndingDate}`,
      destination,
    });

    // Send congratulatory message into VIP Support Chat thread
    try {
      const thread = await getChatThreadByUserId(user.id, user.name, user.email);
      if (thread) {
        await addChatMessageToDb(thread.id, {
          id: `msg-sal-${Date.now()}`,
          threadId: thread.id,
          sender: 'system',
          senderName: 'Royal Automated Disbursements',
          text: `👑 Royal Weekly Salary Disbursed!\n\nCongratulations ${user.name}! Your Sunday affiliate salary of KES ${salaryKES.toLocaleString()} (${currentTier.tierName} Tier with ${qualifyingCount} active partners) has been automatically disbursed to your ${method === 'crypto' ? 'Polygon USDT address' : 'M-Pesa number'} (${destination}).\n\nReference: ${payoutRecord.txHashOrRef}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isRead: false,
        });
      }
    } catch (chatErr) {
      console.warn('[Neon DB] Weekly salary chat notification notice:', chatErr);
    }

    // Log anti-fraud event for transparency
    await logAntiFraudEvent({
      id: `afe-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      eventType: 'WEEKLY_SALARY_DISBURSED',
      userId: user.id,
      userIdentifier: `${user.name} (${user.phone})`,
      riskScore: 0,
      severity: 'low',
      actionTaken: 'RESOLVED',
      details: `Royal Weekly Salary of KES ${salaryKES.toLocaleString()} (${currentTier.tierName} Tier, ${qualifyingCount} partners) auto-disbursed to ${destination} via ${method}.`,
      createdAt: now.toISOString(),
    });
  }

  return { disbursedCount, totalDisbursedKES, payouts };
}

// Chat
export async function getChatThreads(): Promise<ChatThread[]> {
  const sql = getNeonSql();
  if (sql) {
    try {
      const threads: any[] = await sql`SELECT * FROM chat_threads ORDER BY updated_at DESC;`;
      const result: ChatThread[] = [];
      for (const t of threads) {
        const msgs: any[] = await sql`SELECT * FROM chat_messages WHERE thread_id = ${t.id} ORDER BY created_at ASC;`;
        result.push({
          id: t.id,
          userId: t.user_id,
          userName: t.user_name || 'Investor',
          userPhone: t.user_phone || '',
          userEmail: t.user_email || '',
          userReferralCode: t.user_referral_code || '',
          status: t.status || 'active',
          unreadCountUser: t.unread_count_user || 0,
          unreadCountAdmin: t.unread_count_admin || 0,
          lastMessageTime: t.last_message_time || 'Just now',
          lastMessageSnippet: t.last_message_snippet || '',
          messages: msgs.map((m: any) => ({
            id: m.id,
            threadId: m.thread_id,
            sender: m.sender,
            senderName: m.sender_name,
            text: m.text,
            timestamp: m.timestamp_str,
            isRead: Boolean(m.is_read),
            voiceNote: typeof m.voice_note === 'string' ? JSON.parse(m.voice_note) : m.voice_note,
            attachment: typeof m.attachment === 'string' ? JSON.parse(m.attachment) : m.attachment,
          })),
        });
      }
      return result;
    } catch (err) {
      console.warn('[Neon DB] getChatThreads fallback:', err);
    }
  }
  return inMemoryThreads;
}

export async function getChatThreadByUserId(userId: string, userName?: string, userEmail?: string): Promise<ChatThread> {
  const threads = await getChatThreads();
  let thread = threads.find(t => t.userId === userId);
  if (thread) return thread;

  const newThread: ChatThread = {
    id: `thread-${userId}`,
    userId,
    userName: userName || 'Investor',
    userPhone: '',
    userEmail: userEmail || `${userId}@investor.ke`,
    userReferralCode: 'ROYAL-VIP',
    status: 'active',
    unreadCountUser: 0,
    unreadCountAdmin: 0,
    lastMessageTime: 'Just now',
    lastMessageSnippet: 'Welcome to the VIP Concierge Desk!',
    messages: [
      {
        id: `msg-welcome-${Date.now()}`,
        threadId: `thread-${userId}`,
        sender: 'admin',
        senderName: 'VIP Desk Manager',
        text: 'Welcome to the VIP Concierge Desk! How can we assist with your capital portfolio today?',
        timestamp: 'Just now',
        isRead: true,
      }
    ]
  };

  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO chat_threads (id, user_id, user_name, user_email, status, unread_count_user, unread_count_admin, last_message_time, last_message_snippet)
        VALUES (${newThread.id}, ${userId}, ${newThread.userName}, ${newThread.userEmail}, 'active', 0, 0, 'Just now', ${newThread.lastMessageSnippet});
      `;
      await sql`
        INSERT INTO chat_messages (id, thread_id, sender, sender_name, text, timestamp_str, is_read)
        VALUES (${newThread.messages[0].id}, ${newThread.id}, 'admin', 'VIP Desk Manager', ${newThread.messages[0].text}, 'Just now', true);
      `;
    } catch (err) {
      console.warn('[Neon DB] insert thread fallback:', err);
    }
  }

  inMemoryThreads.push(newThread);
  return newThread;
}

export async function addChatMessageToDb(
  threadId: string, 
  msg: ChatMessage,
  snippetParam?: string,
  incUser?: boolean,
  incAdmin?: boolean
): Promise<void> {
  const sql = getNeonSql();
  const snippet = snippetParam || msg.text || (msg.voiceNote ? '🎤 Voice Note' : (msg.attachment ? '📎 Attachment' : 'New message'));

  if (sql) {
    try {
      await sql`
        INSERT INTO chat_messages (
          id, thread_id, sender, sender_name, text, timestamp_str, is_read, voice_note, attachment
        ) VALUES (
          ${msg.id}, ${threadId}, ${msg.sender}, ${msg.senderName || ''}, ${msg.text || ''},
          ${msg.timestamp}, ${msg.isRead || false}, ${msg.voiceNote ? JSON.stringify(msg.voiceNote) : null},
          ${msg.attachment ? JSON.stringify(msg.attachment) : null}
        );
      `;
      await sql`
        UPDATE chat_threads SET 
          updated_at = NOW(), 
          last_message_time = ${msg.timestamp}, 
          last_message_snippet = ${snippet},
          unread_count_user = unread_count_user + ${incUser ? 1 : 0},
          unread_count_admin = unread_count_admin + ${incAdmin ? 1 : 0}
        WHERE id = ${threadId};
      `;
    } catch (err) {
      console.warn('[Neon DB] addChatMessageToDb fallback:', err);
    }
  }

  const thread = inMemoryThreads.find(t => t.id === threadId);
  if (thread) {
    thread.messages.push(msg);
    thread.lastMessageSnippet = snippet;
    thread.lastMessageTime = msg.timestamp;
    if (incUser) thread.unreadCountUser = (thread.unreadCountUser || 0) + 1;
    if (incAdmin) thread.unreadCountAdmin = (thread.unreadCountAdmin || 0) + 1;
  }
}

// Platform Settings
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const sql = getNeonSql();
  if (sql) {
    try {
      const rows: any[] = await sql`
        SELECT * FROM platform_settings 
        ORDER BY CASE WHEN id = 'global_settings' THEN 1 WHEN id = 'default' THEN 2 ELSE 3 END 
        LIMIT 1;
      `;
      if (rows && rows.length > 0) {
        const row = rows[0];
        if (row.settings) {
          const parsed = typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
          inMemorySettings = { ...inMemorySettings, ...parsed };
          return inMemorySettings;
        } else {
          const fromCols: Partial<PlatformSettings> = {
            minWithdrawalKES: Number(row.min_withdrawal_kes || 100),
            mpesaEstimatedHours: Number(row.mpesa_estimated_hours || 6),
            cryptoInstantEnabled: Boolean(row.crypto_instant_enabled ?? true),
            tier1CommissionPercent: Number(row.tier1_commission_percent || 7),
            tier2CommissionPercent: Number(row.tier2_commission_percent || 3),
            tier3CommissionPercent: Number(row.tier3_commission_percent || 1),
            usdtToKesExchangeRate: Number(row.usdt_to_kes_exchange_rate || 130),
            platformStatus: row.platform_status || 'active',
            mpesaWithdrawalFeePercent: Number(row.mpesa_withdrawal_fee_percent || 10),
            cryptoWithdrawalFeePercent: Number(row.crypto_withdrawal_fee_percent || 5),
            antiFraudEnabled: Boolean(row.anti_fraud_enabled ?? true),
            maxDailyWithdrawalKES: Number(row.max_daily_withdrawal_kes || 50000),
            withdrawalCooldownHours: Number(row.withdrawal_cooldown_hours || 24),
            strictPhoneMatchEnabled: Boolean(row.strict_phone_match_enabled ?? true),
            autoFreezeHighRisk: Boolean(row.auto_freeze_high_risk ?? true),
            kycRequiredForHighRisk: Boolean(row.kyc_required_for_high_risk ?? true),
            kycRiskScoreThreshold: Number(row.kyc_risk_score_threshold || 60),
          };
          inMemorySettings = { ...inMemorySettings, ...fromCols };
          return inMemorySettings;
        }
      }
    } catch (err) {
      console.warn('[Neon DB] getPlatformSettings fallback:', err);
    }
  }
  return inMemorySettings;
}

export async function updatePlatformSettingsInDb(newSettings: Partial<PlatformSettings>): Promise<PlatformSettings> {
  const merged = { ...inMemorySettings, ...newSettings };
  inMemorySettings = merged;

  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO platform_settings (
          id, settings, min_withdrawal_kes, mpesa_estimated_hours,
          tier1_commission_percent, tier2_commission_percent, tier3_commission_percent,
          usdt_to_kes_exchange_rate, platform_status, mpesa_withdrawal_fee_percent
        ) VALUES (
          'global_settings', ${JSON.stringify(merged)}, ${merged.minWithdrawalKES || 100},
          ${merged.mpesaEstimatedHours || 6},
          ${merged.tier1CommissionPercent || 7}, ${merged.tier2CommissionPercent || 3},
          ${merged.tier3CommissionPercent || 1}, ${merged.usdtToKesExchangeRate || 130},
          ${merged.platformStatus || 'active'}, ${merged.mpesaWithdrawalFeePercent || 10}
        )
        ON CONFLICT (id) DO UPDATE SET 
          settings = ${JSON.stringify(merged)}, 
          min_withdrawal_kes = ${merged.minWithdrawalKES || 100},
          mpesa_estimated_hours = ${merged.mpesaEstimatedHours || 6},
          tier1_commission_percent = ${merged.tier1CommissionPercent || 7},
          tier2_commission_percent = ${merged.tier2CommissionPercent || 3},
          tier3_commission_percent = ${merged.tier3CommissionPercent || 1},
          usdt_to_kes_exchange_rate = ${merged.usdtToKesExchangeRate || 130},
          platform_status = ${merged.platformStatus || 'active'},
          mpesa_withdrawal_fee_percent = ${merged.mpesaWithdrawalFeePercent || 10},
          updated_at = NOW();
      `;

      await sql`
        UPDATE platform_settings SET 
          settings = ${JSON.stringify(merged)},
          min_withdrawal_kes = ${merged.minWithdrawalKES || 100},
          mpesa_estimated_hours = ${merged.mpesaEstimatedHours || 6},
          tier1_commission_percent = ${merged.tier1CommissionPercent || 7},
          tier2_commission_percent = ${merged.tier2CommissionPercent || 3},
          tier3_commission_percent = ${merged.tier3CommissionPercent || 1},
          usdt_to_kes_exchange_rate = ${merged.usdtToKesExchangeRate || 130},
          platform_status = ${merged.platformStatus || 'active'},
          mpesa_withdrawal_fee_percent = ${merged.mpesaWithdrawalFeePercent || 10},
          updated_at = NOW()
        WHERE id = 'default';
      `.catch(() => {});
    } catch (err) {
      console.warn('[Neon DB] updatePlatformSettingsInDb fallback:', err);
    }
  }
  return merged;
}

// Anti-Fraud & Risk
export async function logAntiFraudEvent(event: AntiFraudEvent): Promise<void> {
  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`
        INSERT INTO antifraud_events (id, event_type, user_id, user_identifier, risk_score, severity, action_taken, details, ip_address)
        VALUES (${event.id}, ${event.eventType}, ${event.userId || null}, ${event.userIdentifier || null}, ${event.riskScore || 0}, ${event.severity || 'low'}, ${event.actionTaken || 'FLAGGED_FOR_REVIEW'}, ${event.details || ''}, ${event.ipAddress || null});
      `;
    } catch (err) {
      console.warn('[Neon DB] logAntiFraudEvent fallback:', err);
    }
  }
  inMemoryAntiFraudEvents.unshift(event);
}

export async function getAntiFraudEvents(limit: number = 100): Promise<AntiFraudEvent[]> {
  const sql = getNeonSql();
  if (sql) {
    try {
      const rows: any[] = await sql`SELECT * FROM antifraud_events ORDER BY created_at DESC LIMIT ${limit};`;
      return rows.map((r: any) => ({
        id: r.id,
        eventType: r.event_type as any,
        userId: r.user_id,
        userIdentifier: r.user_identifier,
        riskScore: Number(r.risk_score),
        severity: r.severity as any,
        actionTaken: r.action_taken as any,
        details: r.details,
        ipAddress: r.ip_address,
        createdAt: r.created_at,
      }));
    } catch (err) {
      console.warn('[Neon DB] getAntiFraudEvents fallback:', err);
    }
  }
  return inMemoryAntiFraudEvents;
}

export async function freezeUserAccount(id: string, reason: string): Promise<boolean> {
  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`UPDATE users SET is_frozen = TRUE, freeze_reason = ${reason} WHERE id = ${id};`;
    } catch (err) {
      console.warn('[Neon DB] freezeUserAccount fallback:', err);
    }
  }
  const u = inMemoryUsers.get(id);
  if (u) {
    u.isFrozen = true;
    u.freezeReason = reason;
  }
  return true;
}

export async function unfreezeUserAccount(id: string): Promise<boolean> {
  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`UPDATE users SET is_frozen = FALSE, freeze_reason = NULL WHERE id = ${id};`;
    } catch (err) {
      console.warn('[Neon DB] unfreezeUserAccount fallback:', err);
    }
  }
  const u = inMemoryUsers.get(id);
  if (u) {
    u.isFrozen = false;
    u.freezeReason = null;
  }
  return true;
}

/**
 * Liquidate & Forfeit all assets for a user who violated platform terms
 * Wipes wallet balance to 0, cancels/liquidates active investments, zeros capital, and freezes account.
 */
export async function liquidateUserAssetsForViolation(userId: string, reason: string): Promise<UserProfile> {
  const user = await findUserById(userId);
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  const previousInvested = user.investedCapitalKES || 0;
  const previousWallet = user.walletBalanceKES || 0;
  const freezeReason = reason || 'Terms of Service Violation: Capital liquidated and wallet forfeited';

  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`
        UPDATE users SET 
          wallet_balance_kes = 0,
          invested_capital_kes = 0,
          total_earnings_accrued_kes = 0,
          is_frozen = TRUE,
          freeze_reason = ${freezeReason},
          updated_at = NOW()
        WHERE id = ${userId};
      `;
      await sql`
        UPDATE investments SET 
          status = 'liquidated',
          unclaimed_yield_kes = 0
        WHERE user_id = ${userId} AND status = 'active';
      `;
    } catch (err) {
      console.warn('[Neon DB] liquidateUserAssetsForViolation DB error:', err);
    }
  }

  // Synchronize memory store
  const u = inMemoryUsers.get(userId);
  if (u) {
    u.walletBalanceKES = 0;
    u.investedCapitalKES = 0;
    u.totalEarningsAccruedKES = 0;
    u.isFrozen = true;
    u.freezeReason = freezeReason;
  }

  for (const inv of inMemoryInvestments) {
    if ((inv as any).userId === userId && inv.status === 'active') {
      inv.status = 'liquidated';
      inv.unclaimedYieldKES = 0;
    }
  }

  // Create audit transaction
  try {
    const auditTx: Transaction = {
      id: `tx-liq-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId,
      type: 'withdrawal',
      amountKES: previousWallet + previousInvested,
      amountUSDT: Math.round(((previousWallet + previousInvested) / 130) * 100) / 100,
      description: `TERMS VIOLATION FORFEITURE: KES ${previousInvested.toLocaleString()} invested + KES ${previousWallet.toLocaleString()} wallet forfeited. Reason: ${freezeReason}`,
      status: 'completed',
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toLocaleString(),
      reference: `TERMS-VIOLATION-${Date.now().toString().slice(-6)}`,
      paymentMethod: 'ADMIN_LIQUIDATION'
    };
    await createTransaction(userId, auditTx);
  } catch (txErr) {
    console.warn('[Neon DB] Liquidation audit tx error:', txErr);
  }

  // Log critical security event
  try {
    await logAntiFraudEvent({
      id: `afe-liq-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      userId,
      userIdentifier: `${user.name} (${user.phone})`,
      eventType: 'SUSPICIOUS_WITHDRAWAL',
      severity: 'critical',
      riskScore: 100,
      actionTaken: 'BLOCKED',
      details: `Violated Terms of Service: All assets liquidated. KES ${previousWallet.toLocaleString()} wallet and KES ${previousInvested.toLocaleString()} active capital forfeited. Reason: ${freezeReason}`,
      createdAt: new Date().toISOString()
    });
  } catch (afeErr) {
    console.warn('[Neon DB] Liquidation antifraud event error:', afeErr);
  }

  const updated = await findUserById(userId);
  return updated!;
}

/**
 * Wipe failed or rejected transactions to clean user/system logs
 */
export async function wipeFailedTransactions(userId?: string): Promise<{ deletedCount: number }> {
  const sql = getNeonSql();
  let deletedCount = 0;

  if (sql) {
    try {
      let res: any[];
      if (userId) {
        res = await sql`
          DELETE FROM transactions 
          WHERE user_id = ${userId} 
            AND (status = 'failed' OR status = 'rejected' OR status = 'cancelled')
          RETURNING id;
        `;
      } else {
        res = await sql`
          DELETE FROM transactions 
          WHERE (status = 'failed' OR status = 'rejected' OR status = 'cancelled')
          RETURNING id;
        `;
      }
      deletedCount = res.length;
    } catch (err) {
      console.warn('[Neon DB] wipeFailedTransactions DB error:', err);
    }
  }

  const beforeCount = inMemoryTransactions.length;
  inMemoryTransactions = inMemoryTransactions.filter(t => {
    const isTarget = !userId || (t as any).userId === userId;
    const isFailed = t.status === 'failed' || t.status === 'rejected' || (t as any).status === 'cancelled';
    return !(isTarget && isFailed);
  });
  deletedCount = Math.max(deletedCount, beforeCount - inMemoryTransactions.length);

  return { deletedCount };
}

/**
 * Wipe user activity logs (chat threads and anti-fraud alerts for a specific user)
 */
export async function wipeUserLogs(userId: string): Promise<{ success: boolean; cleared: string[] }> {
  const sql = getNeonSql();
  const cleared: string[] = [];

  if (sql) {
    try {
      await sql`DELETE FROM chat_messages WHERE thread_id = ${`thread-${userId}`};`;
      await sql`DELETE FROM chat_threads WHERE user_id = ${userId};`;
      cleared.push('chat_messages');
      cleared.push('chat_threads');

      await sql`DELETE FROM antifraud_events WHERE user_id = ${userId};`;
      cleared.push('antifraud_events');
    } catch (err) {
      console.warn('[Neon DB] wipeUserLogs DB error:', err);
    }
  }

  inMemoryThreads = inMemoryThreads.filter(t => t.userId !== userId);
  inMemoryAntiFraudEvents = inMemoryAntiFraudEvents.filter(e => e.userId !== userId);
  cleared.push('in_memory_logs');

  return { success: true, cleared };
}

/**
 * Wipe all Anti-Fraud and Risk logs
 */
export async function wipeAntiFraudLogs(): Promise<{ success: boolean; count: number }> {
  const sql = getNeonSql();
  let count = inMemoryAntiFraudEvents.length;

  if (sql) {
    try {
      const res = await sql`DELETE FROM antifraud_events RETURNING id;`;
      count = Math.max(count, res.length);
    } catch (err) {
      console.warn('[Neon DB] wipeAntiFraudLogs DB error:', err);
    }
  }

  inMemoryAntiFraudEvents = [];
  return { success: true, count };
}

/**
 * Wipe all transaction records for a specific user
 */
export async function wipeUserAllTransactions(userId: string): Promise<{ deletedCount: number }> {
  const sql = getNeonSql();
  let deletedCount = 0;

  if (sql) {
    try {
      const res = await sql`DELETE FROM transactions WHERE user_id = ${userId} RETURNING id;`;
      deletedCount = res.length;
    } catch (err) {
      console.warn('[Neon DB] wipeUserAllTransactions DB error:', err);
    }
  }

  const beforeCount = inMemoryTransactions.length;
  inMemoryTransactions = inMemoryTransactions.filter(t => (t as any).userId !== userId);
  deletedCount = Math.max(deletedCount, beforeCount - inMemoryTransactions.length);

  return { deletedCount };
}

/**
 * Complete clean-slate reset of user account (wipes transactions, investments, logs, resets wallet & capital)
 */
export async function completeUserAccountWipe(userId: string, reason = 'Administrator Clean Slate Reset'): Promise<UserProfile> {
  await wipeUserAllTransactions(userId);
  await wipeUserInvestments(userId, reason);
  await wipeUserLogs(userId);

  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`
        UPDATE users SET 
          wallet_balance_kes = 0,
          invested_capital_kes = 0,
          total_earnings_accrued_kes = 0,
          total_referral_bonus_kes = 0,
          total_withdrawn_kes = 0,
          is_frozen = FALSE,
          freeze_reason = NULL,
          risk_score = 0,
          kyc_status = 'NOT_REQUIRED',
          updated_at = NOW()
        WHERE id = ${userId};
      `;
    } catch (err) {
      console.warn('[Neon DB] completeUserAccountWipe DB error:', err);
    }
  }

  const u = inMemoryUsers.get(userId);
  if (u) {
    u.walletBalanceKES = 0;
    u.investedCapitalKES = 0;
    u.totalEarningsAccruedKES = 0;
    u.totalReferralBonusKES = 0;
    u.totalWithdrawnKES = 0;
    u.isFrozen = false;
    u.freezeReason = undefined;
    u.riskScore = 0;
    u.kycStatus = 'NOT_REQUIRED';
  }

  const updated = await findUserById(userId);
  return updated!;
}

/**
 * Admin directly resets user password
 */
export async function setUserPassword(userId: string, newPassword: string): Promise<boolean> {
  const cleanPass = newPassword.trim();
  if (!cleanPass) throw new Error('Password cannot be empty');

  const sql = getNeonSql();
  if (sql) {
    try {
      await sql`UPDATE users SET password_hash = ${cleanPass}, updated_at = NOW() WHERE id = ${userId};`;
    } catch (err) {
      console.warn('[Neon DB] setUserPassword DB error:', err);
    }
  }

  const u = inMemoryUsers.get(userId);
  if (u) {
    u.passwordHash = cleanPass;
  }
  return true;
}

/**
 * Purge non-admin test data and reset transactions/investments
 */
export async function wipeAllTestData(): Promise<{ success: boolean; message: string }> {
  const sql = getNeonSql();

  if (sql) {
    try {
      await sql`DELETE FROM transactions WHERE type != 'deposit';`;
      await sql`DELETE FROM investments WHERE status = 'liquidated' OR status = 'cancelled';`;
      await sql`DELETE FROM withdrawals WHERE status = 'rejected';`;
      await sql`DELETE FROM antifraud_events WHERE action_taken = 'RESOLVED';`;
    } catch (err) {
      console.warn('[Neon DB] wipeAllTestData DB error:', err);
    }
  }

  inMemoryTransactions = inMemoryTransactions.filter(t => t.status !== 'rejected');
  inMemoryWithdrawals = inMemoryWithdrawals.filter(w => w.status !== 'rejected');
  inMemoryInvestments = inMemoryInvestments.filter(i => i.status !== 'liquidated' && (i as any).status !== 'cancelled');

  return {
    success: true,
    message: 'Test logs, liquidated contracts, and rejected requests purged successfully.'
  };
}

export async function getAntiFraudMetrics(): Promise<AntiFraudMetrics> {
  const events = await getAntiFraudEvents();
  const users = await listAllUsers();
  const settings = await getPlatformSettings();

  const highRiskEvents = events.filter(e => e.severity === 'high' || e.riskScore >= 70);
  const frozenUsers = users.filter(u => u.isFrozen);

  return {
    totalBlockedExploits: events.filter(e => e.actionTaken === 'BLOCKED').length,
    flaggedAccountsCount: users.filter(u => (u.riskScore || 0) > 0 || u.isFrozen).length,
    frozenAccountsCount: frozenUsers.length,
    highRiskWithdrawalsCount: events.filter(e => e.eventType === 'SUSPICIOUS_WITHDRAWAL' || e.riskScore > 60).length,
    kycPendingCount: users.filter(u => u.kycStatus === 'SUBMITTED').length,
    kycRequiredForHighRisk: settings.kycRequiredForHighRisk ?? true,
    kycRiskScoreThreshold: settings.kycRiskScoreThreshold ?? 60,
    antiFraudEnabled: settings.antiFraudEnabled ?? true,
    maxDailyWithdrawalKES: settings.maxDailyWithdrawalKES ?? 200000,
    withdrawalCooldownHours: settings.withdrawalCooldownHours ?? 12,
    strictPhoneMatchEnabled: settings.strictPhoneMatchEnabled ?? true,
    autoFreezeHighRisk: settings.autoFreezeHighRisk ?? true,
  };
}

// Utility mapper
function mapUserRow(r: any): UserProfile {
  return {
    id: r.id,
    name: r.name,
    email: r.email || '',
    phone: r.phone || '',
    passwordHash: r.password_hash || r.passwordHash || '',
    referralCode: r.referral_code,
    referredByCode: r.referred_by_code || undefined,
    walletBalanceKES: Number(r.wallet_balance_kes || 0),
    investedCapitalKES: Number(r.invested_capital_kes || 0),
    totalEarningsAccruedKES: Number(r.total_earnings_accrued_kes || 0),
    totalReferralBonusKES: Number(r.total_referral_bonus_kes || 0),
    totalWithdrawnKES: Number(r.total_withdrawn_kes || 0),
    isFrozen: Boolean(r.is_frozen),
    riskScore: Number(r.risk_score || 0),
    freezeReason: r.freeze_reason || undefined,
    kycStatus: (r.kyc_status as any) || 'NOT_REQUIRED',
    kycData: typeof r.kyc_data === 'string' ? JSON.parse(r.kyc_data) : r.kyc_data || undefined,
    role: (r.role as any) || 'user',
    salaryConfig: typeof r.salary_config === 'string' ? JSON.parse(r.salary_config) : (r.salary_config || r.salaryConfig || undefined),
  };
}

// Export sql proxy for direct tag template queries in services
export const sql = (strings: TemplateStringsArray, ...values: any[]) => {
  const client = getNeonSql();
  if (!client) {
    return Promise.resolve([]);
  }
  return client(strings, ...values);
};
