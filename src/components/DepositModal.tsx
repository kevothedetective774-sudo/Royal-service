import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ArrowDownCircle, 
  Smartphone, 
  Zap, 
  CheckCircle2, 
  QrCode, 
  Loader2, 
  ShieldCheck,
  Clock,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  Info,
  AlertTriangle,
  Rocket,
  Lock,
  Calendar,
  Share2,
  Users
} from 'lucide-react';
import { PlatformSettings, UserProfile } from '../types';
import { isPreLaunchLocked, getTimeRemaining, formatLaunchDate } from '../utils/launchUtils';
import { payheroApi } from '../services/payheroApi';
import { nowpaymentsApi } from '../services/nowpaymentsApi';
import { NowPaymentsDepositResponse } from '../services/nowpaymentsService';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  settings: PlatformSettings;
  onDepositSuccess: (amountKES: number, channel: 'mpesa' | 'crypto', ref: string) => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
  user,
  settings,
  onDepositSuccess,
}) => {
  const [method, setMethod] = useState<'mpesa' | 'crypto'>('mpesa');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [ipErrorDetails, setIpErrorDetails] = useState<{ isIpError: boolean; ip: string; message: string } | null>(null);
  const [amount, setAmount] = useState<number>(900); // default to silver package price
  const [phone, setPhone] = useState(user.phone);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [stkPromptStep, setStkPromptStep] = useState(false);
  const [nowPaymentsPromptStep, setNowPaymentsPromptStep] = useState(false);
  const [nowPaymentsOrder, setNowPaymentsOrder] = useState<NowPaymentsDepositResponse | null>(null);
  const [nowPaymentsStatusText, setNowPaymentsStatusText] = useState('Listening for Polygon blockchain transaction...');
  const [isCheckingNowPayments, setIsCheckingNowPayments] = useState(false);
  const [txRef, setTxRef] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [externalReference, setExternalReference] = useState('');
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if ((stkPromptStep || nowPaymentsPromptStep) && countdown > 0 && !isSuccess) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [stkPromptStep, nowPaymentsPromptStep, countdown, isSuccess]);

  // Clean up polling interval when modal closes
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const launchStatus = isPreLaunchLocked(settings);
  const isDepositLocked = launchStatus.isLocked && launchStatus.lockDeposits;
  const [remainingTime, setRemainingTime] = useState(() => getTimeRemaining(settings.launchDate || null));
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!isOpen || !isDepositLocked) return;
    const ticker = setInterval(() => {
      setRemainingTime(getTimeRemaining(settings.launchDate || null));
    }, 1000);
    return () => clearInterval(ticker);
  }, [isOpen, isDepositLocked, settings.launchDate]);

  if (!isOpen) return null;

  const referralCode = user?.referralCode || 'ROYAL-EARLY';
  const referralLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/?ref=${referralCode}` 
    : `https://royalservices.ke/?ref=${referralCode}`;

  const handleCopyReferral = () => {
    navigator.clipboard?.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const usdtEquivalent = (amount / settings.usdtToKesExchangeRate).toFixed(2);

  const handleTriggerDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDepositLocked) {
      setErrorMessage(`Deposits are currently locked for Pre-Launch. Platform unlocks on ${formatLaunchDate(settings.launchDate || null)}.`);
      return;
    }
    if (amount <= 0) return;
    setErrorMessage(null);
    setIsProcessing(true);

    if (method === 'mpesa') {
      const cleaned = (phone || '').replace(/\D/g, '');
      if (cleaned.length < 9) {
        setIsProcessing(false);
        setErrorMessage('Please enter a valid Safaricom phone number (e.g. 0712345678 or 254712345678).');
        return;
      }

      try {
        // Initiate real PayHero STK Push
        const res = await payheroApi.initiateStkPush({
          amount,
          phoneNumber: phone,
          userId: user.id,
          channelId: settings.payheroChannelId || '11128',
        });

        setExternalReference(res.externalReference);
        setStkPromptStep(true);
        setCountdown(60);

        // Start polling for webhook confirmation from PayHero
        const refToPoll = res.reference || res.externalReference;
        if (pollingRef.current) clearInterval(pollingRef.current);

        pollingRef.current = setInterval(async () => {
          try {
            const statusRes = await payheroApi.checkStatus(refToPoll, res.externalReference);
            if (statusRes.status === 'completed') {
              if (pollingRef.current) clearInterval(pollingRef.current);
              const receipt = statusRes.mpesaReceipt || `MPESA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
              setTxRef(receipt);
              onDepositSuccess(amount, 'mpesa', receipt);
              setIsProcessing(false);
              setStkPromptStep(false);
              setIsSuccess(true);
            } else if (statusRes.status === 'failed') {
              if (pollingRef.current) clearInterval(pollingRef.current);
              setIsProcessing(false);
              setStkPromptStep(false);
              setErrorMessage('Payment was declined or canceled on the phone.');
            }
          } catch (pollErr) {
            console.warn('Status poll error:', pollErr);
          }
        }, 2500);

      } catch (err: any) {
        console.error('M-Pesa STK initiation error:', err);
        setIsProcessing(false);
        setErrorMessage(err.message || 'Failed to initiate M-Pesa prompt. Please check your phone number and try again.');
      }
    } else {
      // USDT on Polygon (Automated NOWPayments Gateway)
      try {
        const order = await nowpaymentsApi.createDeposit({
          userId: user.id,
          amountKES: amount,
          usdtToKesRate: settings.usdtToKesExchangeRate,
        });

        if (!order || !order.payAddress) {
          throw new Error(order?.message || 'NOWPayments did not return a valid deposit address.');
        }

        setNowPaymentsOrder(order);
        setNowPaymentsPromptStep(true);
        setCountdown(300);
        setNowPaymentsStatusText('Listening for Polygon blockchain transaction...');

        if (pollingRef.current) clearInterval(pollingRef.current);

        pollingRef.current = setInterval(async () => {
          try {
            const statusRes = await nowpaymentsApi.checkPaymentStatus(order.paymentId);
            if (statusRes.isConfirmed || statusRes.status === 'completed') {
              if (pollingRef.current) clearInterval(pollingRef.current);
              setTxRef(order.orderId);
              onDepositSuccess(amount, 'crypto', order.orderId);
              setIsProcessing(false);
              setNowPaymentsPromptStep(false);
              setIsSuccess(true);
            } else if (statusRes.paymentStatus === 'confirming') {
              setNowPaymentsStatusText('Confirming on Polygon blockchain...');
            }
          } catch (pollErr) {
            console.warn('NOWPayments status poll notice:', pollErr);
          }
        }, 3000);
      } catch (err: any) {
        console.error('[NOWPayments Client Error]:', err.message);
        setIsProcessing(false);
        setErrorMessage(err.message || 'Failed to create NOWPayments invoice. Please try again.');
      }
    }
  };

  const checkNowPaymentsManually = async () => {
    if (!nowPaymentsOrder) return;
    setIsCheckingNowPayments(true);
    try {
      const statusRes = await nowpaymentsApi.checkPaymentStatus(nowPaymentsOrder.paymentId);
      if (statusRes.isConfirmed || statusRes.status === 'completed') {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setTxRef(nowPaymentsOrder.orderId);
        onDepositSuccess(amount, 'crypto', nowPaymentsOrder.orderId);
        setIsProcessing(false);
        setNowPaymentsPromptStep(false);
        setIsSuccess(true);
      } else {
        setNowPaymentsStatusText(`Status: ${statusRes.paymentStatus || statusRes.status || 'waiting'}`);
      }
    } catch (err: any) {
      console.warn('Manual check error:', err);
    } finally {
      setIsCheckingNowPayments(false);
    }
  };

  const handleClose = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setIsSuccess(false);
    setIsProcessing(false);
    setStkPromptStep(false);
    setNowPaymentsPromptStep(false);
    setNowPaymentsOrder(null);
    setErrorMessage(null);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window with responsive height and internal scrolling */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 16 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative bg-[#0d121d] rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 border border-slate-800 z-10 space-y-4"
        >
          {/* Ambient Glows */}
          <div className="absolute -top-16 -right-16 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <motion.div 
                whileHover={{ rotate: -15 }}
                className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-inner"
              >
                <ArrowDownCircle className="w-5 h-5 stroke-[2.5]" />
              </motion.div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-base tracking-tight">Deposit Funds</h3>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1 animate-pulse">
                    ⚡ Instant
                  </span>
                </div>
                <p className="text-xs text-slate-400">Instant Automated Credit • 0% Deposit Fee</p>
              </div>
            </div>
            <motion.button 
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl bg-slate-800/60 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </motion.button>
          </div>

          {isDepositLocked ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-4 space-y-4 text-center relative z-10"
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-amber-500/20 border border-purple-500/40 flex items-center justify-center mx-auto text-purple-300 shadow-lg shadow-purple-500/20">
                <Rocket className="w-8 h-8 animate-bounce text-purple-300" />
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full text-xs font-bold text-amber-300">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Pre-Launch Lock Active</span>
                </div>
                <h4 className="font-extrabold text-white text-base">
                  {settings.launchTitle || 'Deposits Unlock on Launch Day'}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed px-2">
                  {settings.launchAnnouncement ||
                    'Deposits and investment contracts will automatically unlock when the countdown reaches zero. You can register and invite your team now so everyone is ready on launch day!'}
                </p>
              </div>

              {/* Countdown Ticker Box */}
              <div className="bg-[#080d17] border border-purple-500/40 rounded-2xl p-4 shadow-inner">
                <div className="text-[11px] font-bold text-purple-300 uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  <span>Official Launch In</span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-[#111726] border border-slate-800 rounded-xl p-2 text-center">
                    <div className="text-lg font-black text-white font-mono">{String(remainingTime.days).padStart(2, '0')}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Days</div>
                  </div>
                  <div className="bg-[#111726] border border-slate-800 rounded-xl p-2 text-center">
                    <div className="text-lg font-black text-white font-mono">{String(remainingTime.hours).padStart(2, '0')}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Hours</div>
                  </div>
                  <div className="bg-[#111726] border border-slate-800 rounded-xl p-2 text-center">
                    <div className="text-lg font-black text-white font-mono">{String(remainingTime.minutes).padStart(2, '0')}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Mins</div>
                  </div>
                  <div className="bg-[#111726] border border-amber-500/50 rounded-xl p-2 text-center animate-pulse">
                    <div className="text-lg font-black text-amber-400 font-mono">{String(remainingTime.seconds).padStart(2, '0')}</div>
                    <div className="text-[9px] font-bold text-amber-300 uppercase">Secs</div>
                  </div>
                </div>

                <div className="mt-2.5 text-[11px] text-slate-400 flex items-center justify-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>Target Date: <strong className="text-white">{formatLaunchDate(settings.launchDate || null)}</strong></span>
                </div>
              </div>

              {/* Early Bird Downline Invite Card */}
              <div className="p-3.5 bg-[#080d17] border border-slate-800 rounded-xl text-left space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span>Build Your Referral Downline Early</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Share your link with your network now. When they deposit on launch day, you will immediately earn 7% Tier 1, 3% Tier 2, and 1% Tier 3 instant commissions!
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    readOnly
                    value={referralLink}
                    className="bg-[#111726] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-purple-300 font-mono w-full focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyReferral}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {copiedLink ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-2.5 pt-1">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`🚀 Join me early on Royal Services before the grand launch! Register now to secure early-bird perks: ${referralLink}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share on WhatsApp</span>
                </a>
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  I Understand
                </button>
              </div>
            </motion.div>
          ) : isSuccess ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="text-center py-6 space-y-4 relative z-10"
            >
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 15 }}
                className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.35)]"
              >
                <CheckCircle2 className="w-9 h-9" />
              </motion.div>
              <div className="space-y-1">
                <h4 className="font-bold text-white text-base">⚡ Instant Deposit Credited!</h4>
                <p className="text-xs text-slate-300 max-w-xs mx-auto">
                  Successfully credited <strong className="text-emerald-300 font-mono font-bold">KES {amount.toLocaleString()}</strong> ({method === 'crypto' ? `$${usdtEquivalent} USDT` : 'via M-Pesa STK'}) directly to your active portfolio balance.
                </p>
              </div>
              <div className="p-3 bg-[#0a0e17] rounded-xl border border-slate-800 text-xs text-slate-400 font-mono">
                TxID: {txRef}
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleClose}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold transition cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.25)]"
              >
                Proceed to Investment Plans
              </motion.button>
            </motion.div>
          ) : isProcessing && stkPromptStep ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-6 space-y-3.5 relative z-10"
            >
              <div className="relative w-16 h-16 mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center animate-pulse border border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.35)]">
                  <Smartphone className="w-8 h-8" />
                </div>
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 text-[10px] font-mono font-black px-1.5 py-0.5 rounded-full border border-slate-900 shadow">
                  {countdown}s
                </div>
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
                  <Zap className="w-3 h-3 fill-emerald-400" />
                  <span>M-Pesa Express Checkout</span>
                </div>
                <h4 className="font-bold text-white text-base">STK Prompt Sent to Handset</h4>
                <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                  Please unlock your phone <strong className="text-white font-mono">{phone}</strong> and enter your M-Pesa PIN to authorize <strong className="text-emerald-300 font-mono font-bold">KES {amount.toLocaleString()}</strong>.
                </p>
              </div>

              <div className="p-3 bg-[#0a0e17] rounded-xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1.5 text-left">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Transaction Reference:</span>
                  <span className="font-mono text-emerald-400 font-semibold">{externalReference || 'MP-PENDING'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Payment Status:</span>
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                    Waiting for M-Pesa PIN confirmation...
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white text-xs transition cursor-pointer"
                >
                  Cancel Deposit
                </button>
              </div>
            </motion.div>
          ) : isProcessing && nowPaymentsPromptStep && nowPaymentsOrder ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-5 space-y-3.5 relative z-10"
            >
              {/* NOWPayments QR Code */}
              <div className="relative mx-auto inline-block">
                <div className="p-2.5 bg-white rounded-2xl shadow-[0_0_25px_rgba(168,85,247,0.25)] border-2 border-purple-400">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(nowPaymentsOrder.payAddress)}`} 
                    alt="USDT Polygon QR" 
                    className="w-36 h-36 mx-auto rounded-lg object-contain"
                  />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-purple-600 text-white text-[10px] font-mono font-black px-2 py-0.5 rounded-full border border-slate-900 shadow">
                  {countdown}s
                </div>
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[11px] font-semibold">
                  <Zap className="w-3 h-3 fill-purple-400 text-purple-400" />
                  <span>NOWPayments • Polygon Network</span>
                </div>
                <h4 className="font-bold text-white text-base">Send USDT on Polygon (PoS)</h4>
                <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                  Send exactly <strong className="text-purple-300 font-mono font-bold">${nowPaymentsOrder.payAmountUSDT} USDT</strong> (KES {amount.toLocaleString()}) to the dedicated Polygon address below.
                </p>
              </div>

              {/* Address Card */}
              <div className="p-3 bg-[#0a0e17] rounded-xl border border-slate-800/80 text-[11px] space-y-2 text-left">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Payment ID:</span>
                  <span className="font-mono text-purple-400 font-semibold">{nowPaymentsOrder.paymentId}</span>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-slate-400">Deposit Address (Polygon / MATIC):</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(nowPaymentsOrder.payAddress, 'nowpayAddr')}
                      className="text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'nowpayAddr' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'nowpayAddr' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <p className="font-mono text-[10px] text-slate-200 break-all bg-[#111726] p-2 rounded border border-slate-700">
                    {nowPaymentsOrder.payAddress}
                  </p>
                </div>
                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800">
                  <span className="text-slate-400">Network & Asset:</span>
                  <span className="font-bold text-emerald-400 font-mono">USDT (Polygon PoS)</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Status:</span>
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                    {nowPaymentsStatusText}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={checkNowPaymentsManually}
                  disabled={isCheckingNowPayments}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md"
                >
                  {isCheckingNowPayments ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  <span>Verify Blockchain Status</span>
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={handleTriggerDeposit} className="space-y-4 text-xs relative z-10">
              {errorMessage && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2 text-rose-300 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-rose-200">Payment Error</p>
                    <p className="text-[11px] text-rose-300/90">{errorMessage}</p>
                  </div>
                </div>
              )}
              {/* Payment Channel selector with Instant Badges */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">
                  Select Instant Deposit Channel
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* M-Pesa Instant STK */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setMethod('mpesa')}
                    className={`p-3 rounded-xl border text-left cursor-pointer flex flex-col justify-between transition relative overflow-hidden ${
                      method === 'mpesa'
                        ? 'border-emerald-500 bg-emerald-500/10 text-white font-semibold shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                        : 'border-slate-800 bg-[#111726]/60 hover:bg-[#111726] text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs flex items-center gap-1.5 text-white">
                        <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                        M-Pesa STK
                      </span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold border border-emerald-500/30">
                        ⚡ Instant
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">Direct phone PIN prompt</div>
                  </motion.button>

                  {/* Crypto (USDT on Polygon via NOWPayments) */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setMethod('crypto')}
                    className={`p-3 rounded-xl border text-left cursor-pointer flex flex-col justify-between transition relative overflow-hidden ${
                      method === 'crypto'
                        ? 'border-purple-500 bg-purple-500/10 text-white font-semibold shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                        : 'border-slate-800 bg-[#111726]/60 hover:bg-[#111726] text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs flex items-center gap-1.5 text-white">
                        <Zap className="w-3.5 h-3.5 text-purple-400 fill-purple-400" />
                        USDT (Polygon)
                      </span>
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full font-bold border border-purple-500/30">
                        ⚡ NOWPayments
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400">Automated Polygon USDT</div>
                  </motion.button>
                </div>
              </div>

              {/* Quick Presets */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-300">Quick Plan & Test Presets</label>
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-semibold">
                    PayHero 0 Fee on &lt; 10 KES
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {[1, 5, 10, 500, 900, 2500].map((val) => (
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      key={val}
                      type="button"
                      onClick={() => setAmount(val)}
                      className={`py-2 px-1 rounded-xl border text-xs font-bold cursor-pointer transition font-mono text-center ${
                        amount === val 
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm' 
                          : 'bg-[#111726]/70 hover:bg-[#111726] text-slate-300 border-slate-800'
                      }`}
                    >
                      {val < 10 ? `${val} (Test)` : val.toLocaleString()}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate-300">Deposit Capital (KES)</label>
                  <span className="text-[11px] text-emerald-400 font-semibold">⚡ Instant Credit</span>
                </div>
                <input
                  type="number"
                  value={amount || ''}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-[#0a0e17] border border-slate-700/80 rounded-xl text-sm font-bold text-white font-mono focus:outline-none focus:border-emerald-500 transition"
                  min={settings.minDepositKES ?? 1}
                  step={1}
                  required
                />
                <div className="mt-1 text-[11px] text-slate-400 font-mono">
                  ≈ ${usdtEquivalent} USDT (1 USDT = KES {settings.usdtToKesExchangeRate}) • 0% Deposit Fee
                </div>
              </div>

              {method === 'mpesa' ? (
                <motion.div 
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <label className="block font-semibold text-slate-300 mb-1">M-Pesa Mobile Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0e17] border border-slate-700/80 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                    placeholder="+254 712 345 678"
                    required
                  />
                  <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 mt-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>Instant STK push will be received immediately on this phone.</span>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="p-3.5 bg-[#111726] rounded-xl border border-purple-500/30 text-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <Zap className="w-3.5 h-3.5 text-purple-400 fill-purple-400" />
                        <span>Automated Polygon Transfer</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                        Polygon (USDT)
                      </span>
                    </div>
                    <p className="text-[11.5px] text-slate-300 leading-relaxed">
                      Click below to generate your unique, automated Polygon deposit QR code and wallet address for <strong className="text-white">${usdtEquivalent} USDT</strong>. The system will automatically detect your transfer and credit your balance instantly upon blockchain confirmation.
                    </p>
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-800 text-[11px] text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>Zero manual confirmations needed • Instant automated crediting</span>
                    </div>
                  </div>
                </motion.div>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                id="btn-confirm-deposit"
                disabled={isProcessing}
                className={`w-full py-3 rounded-xl text-xs font-bold text-white transition cursor-pointer shadow-lg flex items-center justify-center gap-2 ${
                  method === 'mpesa' 
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.3)]' 
                    : 'bg-purple-600 hover:bg-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.3)]'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Instant Deposit...</span>
                  </>
                ) : method === 'mpesa' ? (
                  <>
                    <Zap className="w-4 h-4 fill-slate-950" />
                    <span>Send Instant STK Push (KES {amount.toLocaleString()})</span>
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4" />
                    <span>Generate Automated Polygon Invoice (${usdtEquivalent} USDT)</span>
                  </>
                )}
              </motion.button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
