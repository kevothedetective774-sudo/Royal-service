/**
 * PayHero M-Pesa STK Push Client API
 */
import { apiUrl, parseJsonResponse } from '../utils/apiBase';

export interface PayHeroInitiateParams {
  amount: number;
  phoneNumber: string;
  userId?: string;
  channelId?: number | string;
  callbackUrl?: string;
}

export interface PayHeroStatusResponse {
  status: 'completed' | 'failed' | 'pending' | 'processing';
  mpesaReceipt?: string;
  message?: string;
  reference?: string;
  externalReference?: string;
  amount?: number;
}

export const payheroApi = {
  /**
   * Triggers Safaricom M-Pesa STK Push via PayHero backend endpoint
   */
  initiateStkPush: async (params: PayHeroInitiateParams): Promise<{
    success: boolean;
    message: string;
    reference: string;
    externalReference: string;
    CheckoutRequestID?: string;
    status: string;
  }> => {
    const res = await fetch(apiUrl('/api/payhero/stk-push'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const err = await parseJsonResponse(res).catch(() => ({}));
      throw new Error(err.error || err.message || 'Failed to trigger M-Pesa STK Push');
    }

    return parseJsonResponse(res);
  },

  /**
   * Polls payment status using STK reference or external reference
   */
  checkStatus: async (reference: string, externalReference?: string): Promise<PayHeroStatusResponse> => {
    const query = new URLSearchParams();
    if (reference) query.set('reference', reference);
    if (externalReference) query.set('externalReference', externalReference);

    const res = await fetch(apiUrl(`/api/payhero/status?${query.toString()}`));
    if (!res.ok) {
      return { status: 'pending' };
    }

    return parseJsonResponse(res);
  },

  /**
   * Fetches gateway live configuration status
   */
  getConfig: async (): Promise<{
    isLiveConfigured: boolean;
    mode: string;
    channelId: string;
    provider: string;
    callbackUrl: string;
  }> => {
    const res = await fetch(apiUrl('/api/payhero/config'));
    if (!res.ok) throw new Error('Failed to fetch PayHero configuration');
    return parseJsonResponse(res);
  },
};
