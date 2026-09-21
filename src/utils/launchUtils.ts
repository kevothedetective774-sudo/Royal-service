import { PlatformSettings } from '../types';

export interface LaunchStatus {
  isLocked: boolean;
  lockDeposits: boolean;
  lockInvestments: boolean;
  lockWithdrawals: boolean;
  launchDate: Date | null;
  hasPassed: boolean;
  timeRemainingMs: number;
}

/**
 * Determines whether pre-launch lock is currently active on the platform.
 * If preLaunchMode is true and launchDate is in the future, it is locked.
 * As soon as the current time reaches or exceeds launchDate, it automatically unlocks!
 */
export function isPreLaunchLocked(settings?: PlatformSettings | null): LaunchStatus {
  if (!settings || !settings.preLaunchMode) {
    return {
      isLocked: false,
      lockDeposits: false,
      lockInvestments: false,
      lockWithdrawals: false,
      launchDate: null,
      hasPassed: true,
      timeRemainingMs: 0,
    };
  }

  if (settings.launchDate) {
    const targetMs = new Date(settings.launchDate).getTime();
    const nowMs = Date.now();
    const diff = targetMs - nowMs;

    if (diff <= 0) {
      // Launch time has been reached: automatic live mode!
      return {
        isLocked: false,
        lockDeposits: false,
        lockInvestments: false,
        lockWithdrawals: false,
        launchDate: new Date(settings.launchDate),
        hasPassed: true,
        timeRemainingMs: 0,
      };
    }

    return {
      isLocked: true,
      lockDeposits: settings.lockDeposits !== false,
      lockInvestments: settings.lockInvestments !== false,
      lockWithdrawals: settings.lockWithdrawals !== false,
      launchDate: new Date(settings.launchDate),
      hasPassed: false,
      timeRemainingMs: diff,
    };
  }

  // Pre-launch mode without an exact date specified
  return {
    isLocked: true,
    lockDeposits: settings.lockDeposits !== false,
    lockInvestments: settings.lockInvestments !== false,
    lockWithdrawals: settings.lockWithdrawals !== false,
    launchDate: null,
    hasPassed: false,
    timeRemainingMs: 0,
  };
}

export interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  isPassed: boolean;
}

/**
 * Computes human-readable countdown numbers
 */
export function getTimeRemaining(targetDate: Date | string | null): TimeRemaining {
  if (!targetDate) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, isPassed: true };
  }

  const targetMs = typeof targetDate === 'string' ? new Date(targetDate).getTime() : targetDate.getTime();
  const diff = targetMs - Date.now();

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, isPassed: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { days, hours, minutes, seconds, totalMs: diff, isPassed: false };
}

/**
 * Formats a launch date into a human-friendly string with timezone
 */
export function formatLaunchDate(date: Date | string | null): string {
  if (!date) return 'Announcing Soon';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid Date';

  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}
