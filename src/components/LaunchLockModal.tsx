import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Rocket, 
  Clock, 
  Lock, 
  Calendar, 
  Users, 
  Copy, 
  Check, 
  Share2, 
  Gift, 
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { PlatformSettings, UserProfile } from '../types';
import { getTimeRemaining, formatLaunchDate } from '../utils/launchUtils';

interface LaunchLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PlatformSettings;
  user?: UserProfile;
  featureName?: 'Deposit' | 'Investment' | 'Withdrawal' | string;
  onOpenReferrals?: () => void;
}

export const LaunchLockModal: React.FC<LaunchLockModalProps> = ({
  isOpen,
  onClose,
  settings,
  user,
  featureName = 'Deposit & Investment',
  onOpenReferrals,
}) => {
  const [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState(() => getTimeRemaining(settings.launchDate || null));

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setRemaining(getTimeRemaining(settings.launchDate || null));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, settings.launchDate]);

  if (!isOpen) return null;

  const referralCode = user?.referralCode || 'ROYAL-EARLY';
  const referralLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/?ref=${referralCode}` 
    : `https://royalservices.ke/?ref=${referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareText = encodeURIComponent(
    `🚀 Royal Services is launching soon! Join early before launch day to get early-bird bonuses and build your team: ${referralLink}`
  );
  const whatsappUrl = `https://wa.me/?text=${shareText}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#0e1322] border border-purple-500/50 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 text-center relative overflow-hidden"
      >
        {/* Glow */}
        <div className="absolute top-0 right-1/2 translate-x-1/2 -mt-12 w-64 h-32 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon Header */}
        <div className="flex flex-col items-center space-y-2 pt-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-amber-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-lg shadow-purple-500/20">
            <Rocket className="w-8 h-8 animate-bounce text-purple-300" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-full text-xs font-bold text-amber-300">
            <Lock className="w-3.5 h-3.5" />
            <span>{featureName} Locked for Pre-Launch</span>
          </div>
          <h3 className="text-xl font-black text-white">
            {settings.launchTitle || 'Official Platform Launching Soon!'}
          </h3>
          <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
            {settings.launchAnnouncement || 
              'The platform is currently in the pre-launch registration phase. Deposits and contract activations will automatically unlock for everyone when the launch countdown reaches zero!'}
          </p>
        </div>

        {/* Live Countdown Grid */}
        <div className="bg-[#080d17] border border-purple-500/30 rounded-2xl p-4 shadow-inner">
          <div className="text-[11px] font-bold text-purple-300 uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            <span>Official Launch In</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="bg-[#111828] border border-slate-800 rounded-xl p-2.5">
              <div className="text-xl md:text-2xl font-black text-white font-mono">{String(remaining.days).padStart(2, '0')}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Days</div>
            </div>
            <div className="bg-[#111828] border border-slate-800 rounded-xl p-2.5">
              <div className="text-xl md:text-2xl font-black text-white font-mono">{String(remaining.hours).padStart(2, '0')}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Hours</div>
            </div>
            <div className="bg-[#111828] border border-slate-800 rounded-xl p-2.5">
              <div className="text-xl md:text-2xl font-black text-white font-mono">{String(remaining.minutes).padStart(2, '0')}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Mins</div>
            </div>
            <div className="bg-[#111828] border border-amber-500/40 rounded-xl p-2.5 animate-pulse">
              <div className="text-xl md:text-2xl font-black text-amber-400 font-mono">{String(remaining.seconds).padStart(2, '0')}</div>
              <div className="text-[10px] font-bold text-amber-300 uppercase mt-0.5">Secs</div>
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span>Launch Date: <strong className="text-white">{formatLaunchDate(settings.launchDate || null)}</strong></span>
          </div>
        </div>

        {/* Pre-launch perks & Team building call to action */}
        <div className="p-4 bg-[#080d17] border border-slate-800 rounded-2xl text-left space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Users className="w-4 h-4 text-purple-400" />
            <span>What can you do right now?</span>
          </div>
          <ul className="text-[11px] text-slate-300 space-y-1.5 pl-1">
            <li className="flex items-start gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Invite Your Team:</strong> Share your referral link now so your downline is ready to activate on launch day.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Earn 3-Tier Commissions:</strong> You earn 7% Tier 1, 3% Tier 2, and 1% Tier 3 the moment your referrals deposit at launch.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <Gift className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span><strong>Early Bird Advantage:</strong> Enjoy +{settings.earlyBirdBonusPercent || 10}% extra contract yield boost on launch day!</span>
            </li>
          </ul>

          {/* Referral link box */}
          <div className="pt-2 border-t border-slate-800">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Your Pre-Launch Invite Link</label>
            <div className="flex items-center gap-2 bg-[#111828] border border-slate-700 rounded-xl p-1.5">
              <input
                type="text"
                readOnly
                value={referralLink}
                className="bg-transparent text-xs text-purple-300 font-mono w-full px-2 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex gap-3 pt-1">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20"
          >
            <Share2 className="w-4 h-4" />
            <span>Share on WhatsApp</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Understood
          </button>
        </div>
      </motion.div>
    </div>
  );
};
