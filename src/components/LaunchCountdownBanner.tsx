import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Rocket, 
  Clock, 
  Calendar, 
  Gift, 
  Share2, 
  Copy, 
  Check, 
  Sparkles, 
  Users, 
  Lock, 
  ArrowRight,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { PlatformSettings, UserProfile } from '../types';
import { isPreLaunchLocked, getTimeRemaining, formatLaunchDate } from '../utils/launchUtils';

interface LaunchCountdownBannerProps {
  settings: PlatformSettings;
  user?: UserProfile;
  onOpenReferrals?: () => void;
  compact?: boolean;
}

export const LaunchCountdownBanner: React.FC<LaunchCountdownBannerProps> = ({
  settings,
  user,
  onOpenReferrals,
  compact = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [launchState, setLaunchState] = useState(() => isPreLaunchLocked(settings));
  const [remaining, setRemaining] = useState(() => getTimeRemaining(settings.launchDate || null));

  // Ticking countdown interval every second
  useEffect(() => {
    const updateTicker = () => {
      const state = isPreLaunchLocked(settings);
      setLaunchState(state);
      setRemaining(getTimeRemaining(settings.launchDate || null));
    };

    updateTicker();
    const interval = setInterval(updateTicker, 1000);
    return () => clearInterval(interval);
  }, [settings.preLaunchMode, settings.launchDate, settings.lockDeposits, settings.lockInvestments]);

  // If not locked and launch has passed, do not show or show celebratory live badge
  if (!launchState.isLocked) {
    return null;
  }

  const referralCode = user?.referralCode || 'ROYAL-EARLY';
  const referralLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/?ref=${referralCode}` 
    : `https://royalservices.ke/?ref=${referralCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareText = encodeURIComponent(
    `🚀 Join me early on Royal Services before the grand launch! Register now to secure early-bird bonuses and get ready: ${referralLink}`
  );
  const whatsappUrl = `https://wa.me/?text=${shareText}`;

  if (compact) {
    return (
      <div className="bg-gradient-to-r from-purple-900/40 via-amber-900/30 to-purple-900/40 border border-purple-500/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-purple-500/20 rounded-lg border border-purple-500/40 text-purple-300">
            <Rocket className="w-4 h-4 animate-bounce" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>{settings.launchTitle || 'Official Platform Launch'}</span>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full">
                Pre-Launch
              </span>
            </div>
            <div className="text-[11px] text-slate-300">
              Unlocks on <strong className="text-purple-200">{formatLaunchDate(settings.launchDate || null)}</strong>
            </div>
          </div>
        </div>

        {/* Mini Ticker */}
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <div className="bg-[#080d17] border border-purple-500/40 px-2 py-1 rounded text-center min-w-[36px]">
            <span className="font-bold text-white">{String(remaining.days).padStart(2, '0')}</span>
            <span className="text-[9px] block text-slate-400">D</span>
          </div>
          <span className="text-purple-400 font-bold">:</span>
          <div className="bg-[#080d17] border border-purple-500/40 px-2 py-1 rounded text-center min-w-[36px]">
            <span className="font-bold text-white">{String(remaining.hours).padStart(2, '0')}</span>
            <span className="text-[9px] block text-slate-400">H</span>
          </div>
          <span className="text-purple-400 font-bold">:</span>
          <div className="bg-[#080d17] border border-purple-500/40 px-2 py-1 rounded text-center min-w-[36px]">
            <span className="font-bold text-white">{String(remaining.minutes).padStart(2, '0')}</span>
            <span className="text-[9px] block text-slate-400">M</span>
          </div>
          <span className="text-purple-400 font-bold">:</span>
          <div className="bg-[#080d17] border border-purple-500/40 px-2 py-1 rounded text-center min-w-[36px]">
            <span className="font-bold text-amber-400">{String(remaining.seconds).padStart(2, '0')}</span>
            <span className="text-[9px] block text-slate-400">S</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-purple-500/40 bg-gradient-to-br from-[#0e1222] via-[#14122b] to-[#1a1128] shadow-2xl p-5 md:p-6 mb-6"
    >
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-64 h-64 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-4">
        {/* Top Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500" />
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1.5">
              <Rocket className="w-3.5 h-3.5 text-purple-400" />
              <span>Pre-Launch Countdown</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              Registrations & Referrals 100% OPEN
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-300 bg-[#080d17]/80 px-3 py-1.5 rounded-xl border border-slate-800">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span>Official Launch: <strong className="text-white">{formatLaunchDate(settings.launchDate || null)}</strong></span>
          </div>
        </div>

        {/* Main Content & Big Countdown Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-7 space-y-2">
            <h2 className="text-lg md:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>{settings.launchTitle || '🚀 Official Royal Service Platform Launch'}</span>
            </h2>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
              {settings.launchAnnouncement || 
                'Welcome to the official pre-registration and team-building phase! Deposits and investment contracts will automatically unlock at launch. Register, complete your profile, and build your referral team today to earn immediate commission when trading opens.'}
            </p>

            {/* Early Bird Perks */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300">
                <Gift className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold">Early Bird Perk: +{settings.earlyBirdBonusPercent || 10}% Yield Boost at Launch</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-300">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                <span className="font-semibold">Guaranteed Contract Allocation</span>
              </div>
            </div>
          </div>

          {/* Large Countdown Cards */}
          <div className="lg:col-span-5 bg-[#080d17]/90 border border-purple-500/30 rounded-2xl p-4 shadow-xl">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center mb-2.5 flex items-center justify-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              <span>Unlocks In</span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-[#0e1424] border border-purple-500/40 rounded-xl p-2.5 shadow">
                <div className="text-xl md:text-2xl font-black text-white font-mono">
                  {String(remaining.days).padStart(2, '0')}
                </div>
                <div className="text-[10px] font-bold text-purple-300 uppercase mt-0.5">Days</div>
              </div>

              <div className="bg-[#0e1424] border border-purple-500/40 rounded-xl p-2.5 shadow">
                <div className="text-xl md:text-2xl font-black text-white font-mono">
                  {String(remaining.hours).padStart(2, '0')}
                </div>
                <div className="text-[10px] font-bold text-purple-300 uppercase mt-0.5">Hours</div>
              </div>

              <div className="bg-[#0e1424] border border-purple-500/40 rounded-xl p-2.5 shadow">
                <div className="text-xl md:text-2xl font-black text-white font-mono">
                  {String(remaining.minutes).padStart(2, '0')}
                </div>
                <div className="text-[10px] font-bold text-purple-300 uppercase mt-0.5">Mins</div>
              </div>

              <div className="bg-[#0e1424] border border-amber-500/50 rounded-xl p-2.5 shadow animate-pulse">
                <div className="text-xl md:text-2xl font-black text-amber-400 font-mono">
                  {String(remaining.seconds).padStart(2, '0')}
                </div>
                <div className="text-[10px] font-bold text-amber-300 uppercase mt-0.5">Secs</div>
              </div>
            </div>

            {/* Locked Action Badges */}
            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-1 text-amber-400/90 font-medium">
                <Lock className="w-3 h-3" />
                <span>Deposits: Locked</span>
              </div>
              <div className="flex items-center gap-1 text-amber-400/90 font-medium">
                <Lock className="w-3 h-3" />
                <span>Investments: Locked</span>
              </div>
              <div className="flex items-center gap-1 text-emerald-400 font-medium">
                <Check className="w-3 h-3" />
                <span>Auto-Unlocks at 00:00</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Quick-Action Bar: Referral Recruiting & WhatsApp Share */}
        <div className="p-3.5 bg-[#080d17]/95 border border-purple-500/20 rounded-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-slate-300">
            <div className="p-1.5 bg-purple-500/20 rounded-lg text-purple-300 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-white font-bold">Build Your Team Early: </span>
              <span className="text-slate-300">Invite referrals now to build 3-tier commissions before deposits unlock!</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-purple-600/30"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Link Copied!' : 'Copy Referral Link'}</span>
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/30"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share WhatsApp</span>
            </a>

            {onOpenReferrals && (
              <button
                type="button"
                onClick={onOpenReferrals}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
              >
                <span>View Team</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
