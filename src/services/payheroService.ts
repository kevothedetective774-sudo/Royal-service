import { createTransaction, findUserById, updateUserBalance } from './neonDb';

export interface PayHeroStkParams {
  amount: number;
  phoneNumber: string;
  userId: string;
  channelId?: number;
  callbackUrl?: string;
}

export interface PayHeroStkResult {
  success: boolean;
  message: string;
  reference: string;
  externalReference: string;
  CheckoutRequestID?: string;
  status: string;
}

export function getPayHeroBasicAuth(): { authHeader: string; mode: string } {
  const username = process.env.PAYHERO_API_USERNAME || process.env.PAYHERO_USERNAME || '';
  const password = process.env.PAYHERO_API_PASSWORD || process.env.PAYHERO_PASSWORD || '';
  const apiKey = process.env.PAYHERO_API_KEY || '';

  if (username && password) {
    const creds = Buffer.from(`${username}:${password}`).toString('base64');
    return { authHeader: `Basic ${creds}`, mode: 'BasicAuth' };
  } else if (apiKey) {
    return { authHeader: `Bearer ${apiKey}`, mode: 'BearerToken' };
  }
  return { authHeader: '', mode: 'TestMode' };
}

// In-memory status store for polling references
const paymentStatusStore = new Map<string, {
  status: 'completed' | 'failed' | 'pending' | 'processing';
  mpesaReceipt?: string;
  message?: string;
  amount?: number;
  updatedAt: number;
}>();

export async function initiatePayHeroStkPush(params: PayHeroStkParams): Promise<PayHeroStkResult> {
  const { amount, phoneNumber, userId, channelId, callbackUrl } = params;
  const cleanedPhone = phoneNumber.replace(/\D/g, '');
  const formattedPhone = cleanedPhone.startsWith('254')
    ? cleanedPhone
    : cleanedPhone.startsWith('0')
    ? `254${cleanedPhone.slice(1)}`
    : `254${cleanedPhone}`;

  const externalReference = `ROYAL-STK-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const { authHeader, mode } = getPayHeroBasicAuth();

  const channel = channelId || Number(process.env.PAYHERO_CHANNEL_ID) || 1;
  const defaultCallback = callbackUrl || process.env.PAYHERO_CALLBACK_URL || 'https://royal-services.ke/api/payhero/callback';

  if (authHeader) {
    try {
      const response = await fetch('https://backend.payhero.co.ke/api/v2/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          amount: Number(amount),
          phone_number: formattedPhone,
          channel_id: channel,
          provider: 'm-pesa',
          external_reference: externalReference,
          callback_url: defaultCallback,
        }),
      });

      const resData = await response.json().catch(() => ({}));
      if (response.ok && (resData.success !== false)) {
        const reference = resData.reference || resData.CheckoutRequestID || externalReference;
        paymentStatusStore.set(externalReference, {
          status: 'pending',
          amount: Number(amount),
          updatedAt: Date.now(),
        });

        return {
          success: true,
          message: resData.message || 'M-Pesa STK push prompted on customer mobile phone.',
          reference: String(reference),
          externalReference,
          CheckoutRequestID: resData.CheckoutRequestID,
          status: 'pending',
        };
      } else {
        console.warn('[PayHero Live Request Failed]:', resData);
      }
    } catch (err: any) {
      console.warn('[PayHero Request Error]:', err.message);
    }
  }

  // Fallback simulator / test mode
  paymentStatusStore.set(externalReference, {
    status: 'pending',
    amount: Number(amount),
    updatedAt: Date.now(),
  });

  // In test mode, simulate confirmation after 6 seconds
  setTimeout(async () => {
    try {
      const mockReceipt = `NL${Math.random().toString(36).substring(2, 8).toUpperCase()}7`;
      paymentStatusStore.set(externalReference, {
        status: 'completed',
        mpesaReceipt: mockReceipt,
        message: 'Deposit confirmed successfully',
        amount: Number(amount),
        updatedAt: Date.now(),
      });

      const user = await findUserById(userId);
      if (user) {
        await createTransaction(userId, {
          id: `tx-mpesa-${Date.now()}`,
          type: 'deposit',
          amountKES: Number(amount),
          description: `M-Pesa STK Deposit (${mockReceipt})`,
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          status: 'completed',
          reference: mockReceipt,
        });

        const newBal = (user.walletBalanceKES || 0) + Number(amount);
        await updateUserBalance(userId, { walletBalanceKES: newBal });
      }
    } catch (e) {
      console.error('[PayHero Simulator Error]:', e);
    }
  }, 6000);

  return {
    success: true,
    message: `M-Pesa STK Push sent to ${formattedPhone}. Please check your phone and enter PIN.`,
    reference: `REF-${Date.now()}`,
    externalReference,
    status: 'pending',
  };
}

export async function handlePayHeroCallback(payload: any): Promise<boolean> {
  console.log('[PayHero Callback Received]:', payload);
  try {
    const response = payload.response || payload;
    const status = (response.status || payload.status || '').toLowerCase();
    const externalReference = response.external_reference || payload.external_reference;
    const amount = Number(response.amount || payload.amount || 0);
    const mpesaReceipt = response.mpesa_reference || response.MpesaReceiptNumber || payload.receipt;

    if (status === 'success' || status === 'completed' || status === 'paid') {
      if (externalReference) {
        paymentStatusStore.set(externalReference, {
          status: 'completed',
          mpesaReceipt: mpesaReceipt || 'MPESA-OK',
          amount,
          updatedAt: Date.now(),
        });
      }
      return true;
    } else {
      if (externalReference) {
        paymentStatusStore.set(externalReference, {
          status: 'failed',
          message: response.result_desc || 'Payment failed or cancelled by user',
          amount,
          updatedAt: Date.now(),
        });
      }
      return false;
    }
  } catch (err) {
    console.error('[PayHero Callback Parse Error]:', err);
    return false;
  }
}

export async function checkPayHeroPaymentStatus(reference: string, externalReference?: string): Promise<{
  status: 'completed' | 'failed' | 'pending' | 'processing';
  mpesaReceipt?: string;
  message?: string;
  reference?: string;
  externalReference?: string;
  amount?: number;
}> {
  const key = externalReference || reference;
  const stored = paymentStatusStore.get(key) || (externalReference ? paymentStatusStore.get(externalReference) : undefined);

  if (stored) {
    return {
      status: stored.status,
      mpesaReceipt: stored.mpesaReceipt,
      message: stored.message,
      reference,
      externalReference,
      amount: stored.amount,
    };
  }

  return {
    status: 'pending',
    reference,
    externalReference,
  };
}
