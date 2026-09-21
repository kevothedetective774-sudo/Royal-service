import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Rocket, 
  Clock, 
  Calendar, 
  Lock, 
  Unlock, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Gift, 
  Users, 
  ShieldCheck, 
  Sparkles,
  Sliders,
  Globe,
  Radio,
  Share2
} from 'lucide-react';
import { PlatformSettings } from '../types';
import { isPreLaunchLocked, getTimeRemaining, formatLaunchDate } from '../utils/launchUtils';

interface AdminLaunchControlsProps {
  settings: PlatformSettings;
  onUpdateSettings: (newSettings: PlatformSettings) => Promise<void> | void;
}

export const AdminLaunchControls: React.FC<AdminLaunchControlsProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [formData, setFormData] = useState({
    preLaunchMode: settings.preLaunchMode ?? true,
    launchDate: settings.launchDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    launchTitle: settings.launchTitle || '🚀 Official Royal Service Platform Launch',
    launchAnnouncement: settings.launchAnnouncement || 'Pre-registration & team referral building is currently OPEN! Deposits and investment contracts will automatically unlock at launch. Secure your spot early!',
    lockDeposits: settings.lockDeposits ?? true,
    lockInvestments: settings.lockInvestments ?? true,
    lockWithdrawals: settings.lockWithdrawals ?? true,
    earlyBirdBonusPercent: settings.earlyBirdBonusPercent ?? 10,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [launchStatus, setLaunchStatus] = useState(() => isPreLaunchLocked(settings));
  const [remaining, setRemaining] = useState(() => getTimeRemaining(settings.launchDate || null));

  // Keep live preview ticking
  useEffect(() => {
    const updateTicker = () => {
      setLaunchStatus(isPreLaunchLocked({
        ...settings,
        preLaunchMode: formData.preLaunchMode,
        launchDate: formData.launchDate,
        lockDeposits: formData.lockDeposits,
        lockInvestments: formData.lockInvestments,
        lockWithdrawals: formData.lockWithdrawals,
      }));
      setRemaining(getTimeRemaining(formData.launchDate));
    };

    updateTicker();
    const interval = setInterval(updateTicker, 1000);
    return () => clearInterval(interval);
  }, [formData, settings]);

  // Format ISO string to datetime-local input value
  const toDateTimeLocalValue = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      // local ISO string slice
      const offsetMs = d.getTimezoneOffset() * 60000;
      const local = new Date(d.getTime() - offsetMs);
      return local.toISOString().slice(0, 16);
    } catch {
      return '';
    }
  };

  const handleDateTimeChange = (localVal: string) => {
    if (!localVal) return;
    try {
      const d = new Date(localVal);
      setFormData(prev => ({ ...prev, launchDate: d.toISOString() }));
    } catch (e) {
      console.warn('Date parse error', e);
    }
  };

  // Quick Presets
  const setPresetHours = (hours: number) => {
    const target = new Date(Date.now() + hours * 60 * 60 * 1000);
    setFormData(prev => ({
      ...prev,
      preLaunchMode: true,
      launchDate: target.toISOString(),
    }));
  };

  // 1-Click GO LIVE NOW
  const handleGoLiveImmediately = async () => {
    const updated: PlatformSettings = {
      ...settings,
      preLaunchMode: false,
      lockDeposits: false,
      lockInvestments: false,
      lockWithdrawals: false,
    };
    setIsSaving(true);
    try {
      await onUpdateSettings(updated);
      setFormData(prev => ({
        ...prev,
        preLaunchMode: false,
        lockDeposits: false,
        lockInvestments: false,
        lockWithdrawals: false,
      }));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  // Save all settings
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      const updated: PlatformSettings = {
        ...settings,
        preLaunchMode: formData.preLaunchMode,
        launchDate: formData.launchDate,
        launchTitle: formData.launchTitle,
        launchAnnouncement: formData.launchAnnouncement,
        lockDeposits: formData.lockDeposits,
        lockInvestments: formData.lockInvestments,
        lockWithdrawals: formData.lockWithdrawals,
        earlyBirdBonusPercent: Number(formData.earlyBirdBonusPercent) || 10,
      };
      await onUpdateSettings(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Platform Status Banner */}
      <div className={`p-6 rounded-2xl border shadow-xl transition ${
        launchStatus.isLocked 
          ? 'bg-gradient-to-r from-purple-950/70 via-[#13112b] to-amber-950/50 border-purple-500/50' 
          : 'bg-gradient-to-r from-emerald-950/60 via-[#0a1b1a] to-[#0d1424] border-emerald-500/50'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl border ${
              launchStatus.isLocked 
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' 
                : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
            }`}>
              {launchStatus.isLocked ? <Rocket className="w-8 h-8 animate-bounce" /> : <Zap className="w-8 h-8 text-emerald-400" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">
                  {launchStatus.isLocked ? 'PRE-LAUNCH COUNTDOWN ACTIVE' : 'PLATFORM IS 100% LIVE'}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  launchStatus.isLocked 
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse' 
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  {launchStatus.isLocked ? 'Locks Enforced' : 'Open Trading'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {launchStatus.isLocked 
                  ? `Deposits & Investments are locked. Registrations & referrals are open. Automatic unlock: ${formatLaunchDate(formData.launchDate)}`
                  : 'All users can deposit, buy investment contracts, and withdraw with full system availability.'}
              </p>
            </div>
          </div>

          {/* Quick Action Button */}
          <div>
            {launchStatus.isLocked ? (
              <button
                type="button"
                onClick={handleGoLiveImmediately}
                disabled={isSaving}
                className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
              >
                {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                <span>⚡ GO LIVE IMMEDIATELY</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, preLaunchMode: true }));
                }}
                className="px-4 py-2.5 bg-purple-600/30 hover:bg-purple-600/40 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
              >
                <Rocket className="w-4 h-4" />
                <span>Re-enable Pre-Launch Mode</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Investor Countdown Ticker Preview */}
        {launchStatus.isLocked && (
          <div className="mt-5 pt-4 border-t border-purple-500/30 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-slate-300 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Investor Countdown Clock Preview:</span>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs">
              <div className="bg-[#080d17] border border-purple-500/40 px-3 py-1.5 rounded-xl text-center min-w-[50px]">
                <div className="text-base font-black text-white">{String(remaining.days).padStart(2, '0')}</div>
                <div className="text-[9px] text-purple-300 font-bold uppercase">Days</div>
              </div>
              <span className="text-purple-400 font-bold text-base">:</span>
              <div className="bg-[#080d17] border border-purple-500/40 px-3 py-1.5 rounded-xl text-center min-w-[50px]">
                <div className="text-base font-black text-white">{String(remaining.hours).padStart(2, '0')}</div>
                <div className="text-[9px] text-purple-300 font-bold uppercase">Hours</div>
              </div>
              <span className="text-purple-400 font-bold text-base">:</span>
              <div className="bg-[#080d17] border border-purple-500/40 px-3 py-1.5 rounded-xl text-center min-w-[50px]">
                <div className="text-base font-black text-white">{String(remaining.minutes).padStart(2, '0')}</div>
                <div className="text-[9px] text-purple-300 font-bold uppercase">Mins</div>
              </div>
              <span className="text-purple-400 font-bold text-base">:</span>
              <div className="bg-[#080d17] border border-amber-500/50 px-3 py-1.5 rounded-xl text-center min-w-[50px] animate-pulse">
                <div className="text-base font-black text-amber-400">{String(remaining.seconds).padStart(2, '0')}</div>
                <div className="text-[9px] text-amber-300 font-bold uppercase">Secs</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="bg-[#0d1320] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="border-b border-slate-800 pb-4">
          <h3 className="font-bold text-white text-base">Launch Schedule & Lock Parameters</h3>
          <p className="text-xs text-slate-400 mt-1">
            Configure the official launch timestamp. When this exact moment arrives, the platform automatically goes live and unlocks all deposits and investments.
          </p>
        </div>

        {/* Master Pre-Launch Mode Switch */}
        <div className="p-4 bg-[#080d17] border border-slate-800 rounded-xl flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="font-bold text-white text-xs flex items-center gap-2">
              <span>Enable Pre-Launch Mode</span>
              {formData.preLaunchMode && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full">
                  ACTIVE
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              When ON, the platform acts as a pre-registration & referral building gateway with locked financial transactions.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.preLaunchMode}
              onChange={(e) => setFormData(prev => ({ ...prev, preLaunchMode: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {/* Launch Date & Presets */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>Official Launch Date & Time</span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
            <input
              type="datetime-local"
              value={toDateTimeLocalValue(formData.launchDate)}
              onChange={(e) => handleDateTimeChange(e.target.value)}
              className="w-full bg-[#111726] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
            />

            {/* Quick preset buttons */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setPresetHours(12)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded-lg border border-slate-700 cursor-pointer"
              >
                +12 Hours
              </button>
              <button
                type="button"
                onClick={() => setPresetHours(24)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded-lg border border-slate-700 cursor-pointer"
              >
                +24 Hours (Tomorrow)
              </button>
              <button
                type="button"
                onClick={() => setPresetHours(72)}
                className="px-2.5 py-1.5 bg-purple-900/40 hover:bg-purple-900/60 text-[11px] text-purple-200 rounded-lg border border-purple-500/40 cursor-pointer"
              >
                +3 Days (Recommended)
              </button>
              <button
                type="button"
                onClick={() => setPresetHours(168)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 rounded-lg border border-slate-700 cursor-pointer"
              >
                +7 Days (1 Week)
              </button>
            </div>
          </div>
          <div className="text-[11px] text-slate-400">
            Selected target: <strong className="text-white">{formatLaunchDate(formData.launchDate)}</strong>
          </div>
        </div>

        {/* Feature Lock Checkboxes */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-purple-400" />
            <span>Restrictions Enforced During Pre-Launch</span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition ${
              formData.lockDeposits ? 'bg-amber-500/10 border-amber-500/40 text-white' : 'bg-[#080d17] border-slate-800 text-slate-400'
            }`}>
              <input
                type="checkbox"
                checked={formData.lockDeposits}
                onChange={(e) => setFormData(prev => ({ ...prev, lockDeposits: e.target.checked }))}
                className="rounded border-slate-700 text-amber-500 focus:ring-0"
              />
              <div>
                <div className="text-xs font-bold">Lock Deposits</div>
                <div className="text-[10px] text-slate-400">M-Pesa & Crypto deposits blocked</div>
              </div>
            </label>

            <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition ${
              formData.lockInvestments ? 'bg-purple-500/10 border-purple-500/40 text-white' : 'bg-[#080d17] border-slate-800 text-slate-400'
            }`}>
              <input
                type="checkbox"
                checked={formData.lockInvestments}
                onChange={(e) => setFormData(prev => ({ ...prev, lockInvestments: e.target.checked }))}
                className="rounded border-slate-700 text-purple-500 focus:ring-0"
              />
              <div>
                <div className="text-xs font-bold">Lock Investments</div>
                <div className="text-[10px] text-slate-400">Buying packages blocked</div>
              </div>
            </label>

            <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition ${
              formData.lockWithdrawals ? 'bg-rose-500/10 border-rose-500/40 text-white' : 'bg-[#080d17] border-slate-800 text-slate-400'
            }`}>
              <input
                type="checkbox"
                checked={formData.lockWithdrawals}
                onChange={(e) => setFormData(prev => ({ ...prev, lockWithdrawals: e.target.checked }))}
                className="rounded border-slate-700 text-rose-500 focus:ring-0"
              />
              <div>
                <div className="text-xs font-bold">Lock Withdrawals</div>
                <div className="text-[10px] text-slate-400">Withdrawals locked</div>
              </div>
            </label>
          </div>

          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              <strong>Registration & Referral Invites:</strong> ALWAYS open! Users can freely register, customize their profiles, and share referral links to build their 3-tier downline.
            </span>
          </div>
        </div>

        {/* Messaging & Announcements */}
        <div className="space-y-4 pt-2 border-t border-slate-800">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Launch Broadcast Headline
            </label>
            <input
              type="text"
              value={formData.launchTitle}
              onChange={(e) => setFormData(prev => ({ ...prev, launchTitle: e.target.value }))}
              placeholder="e.g. 🚀 Official Royal Service Platform Launch"
              className="w-full bg-[#111726] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Launch Announcement Message (Shown across User Dashboards & Modals)
            </label>
            <textarea
              rows={3}
              value={formData.launchAnnouncement}
              onChange={(e) => setFormData(prev => ({ ...prev, launchAnnouncement: e.target.value }))}
              placeholder="Explain the pre-launch phase and when deposits & investments unlock..."
              className="w-full bg-[#111726] border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-500 leading-relaxed"
            />
          </div>

          <div className="space-y-1.5 max-w-xs">
            <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Gift className="w-3.5 h-3.5 text-amber-400" />
              <span>Early Bird Bonus Yield Boost (%)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={50}
                value={formData.earlyBirdBonusPercent}
                onChange={(e) => setFormData(prev => ({ ...prev, earlyBirdBonusPercent: Number(e.target.value) }))}
                className="w-28 bg-[#111726] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
              />
              <span className="text-xs text-slate-400">% added return for launch-day contracts</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <div>
            {saveSuccess && (
              <span className="text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Launch settings saved & synchronized!</span>
              </span>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-purple-600/30 cursor-pointer"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Save Launch Settings</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
