import React, { useEffect, useMemo, useState } from 'react';
import { MicrophoneIcon } from '@heroicons/react/24/outline';
import { i18nService } from '../services/i18n';
import {
  getWakeActivationOverlaySubtitleKey,
  WakeActivationOverlayPhase,
} from './wakeActivationOverlayHelpers';

interface WakeActivationOverlayProps {
  phase: WakeActivationOverlayPhase;
  transcript: string;
}

const WakeActivationOverlay: React.FC<WakeActivationOverlayProps> = ({ phase, transcript }) => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncPreference = () => {
      setPrefersReducedMotion(media.matches);
    };

    syncPreference();
    media.addEventListener('change', syncPreference);
    return () => {
      media.removeEventListener('change', syncPreference);
    };
  }, []);

  const shellClassName = useMemo(
    () => (
      prefersReducedMotion
        ? 'qs-wake-activation-shell qs-wake-activation-shell-reduced'
        : 'qs-wake-activation-shell'
    ),
    [prefersReducedMotion]
  );

  const ringClassName = prefersReducedMotion
    ? 'qs-wake-activation-ring qs-wake-activation-ring-reduced'
    : 'qs-wake-activation-ring';
  const subtitleKey = getWakeActivationOverlaySubtitleKey(phase);
  const trimmedTranscript = transcript.trim();
  const showTranscript = phase !== WakeActivationOverlayPhase.Preparing && trimmedTranscript.length > 0;
  const showDictatingBars = phase === WakeActivationOverlayPhase.Dictating && !showTranscript;
  const showSubmittingDots = phase === WakeActivationOverlayPhase.Submitting && !showTranscript;

  return (
    <>
      <style>
        {`
          @keyframes qs-wake-activation-shell-in {
            0% { opacity: 0; transform: translate3d(0, -12px, 0) scale(0.985); }
            100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
          }

          @keyframes qs-wake-activation-halo-breathe {
            0%, 100% { opacity: 0.28; transform: scale(0.94); }
            50% { opacity: 0.72; transform: scale(1.06); }
          }

          @keyframes qs-wake-activation-ring-wave {
            0% { opacity: 0.42; transform: scale(0.72); }
            100% { opacity: 0; transform: scale(1.45); }
          }

          @keyframes qs-wake-activation-core-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.06); }
          }

          @keyframes qs-wake-activation-copy-in {
            0% { opacity: 0; transform: translate3d(0, 4px, 0); }
            100% { opacity: 1; transform: translate3d(0, 0, 0); }
          }

          @keyframes qs-wake-activation-bar {
            0%, 100% { transform: scaleY(0.45); opacity: 0.42; }
            50% { transform: scaleY(1); opacity: 1; }
          }

          @keyframes qs-wake-activation-dot {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.32; }
            40% { transform: translateY(-2px); opacity: 1; }
          }

          .qs-wake-activation-shell {
            animation: qs-wake-activation-shell-in 280ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          }

          .qs-wake-activation-shell-reduced {
            animation-duration: 180ms;
          }

          .qs-wake-activation-halo {
            animation: qs-wake-activation-halo-breathe 1600ms ease-in-out infinite;
          }

          .qs-wake-activation-ring {
            animation: qs-wake-activation-ring-wave 1650ms ease-out infinite;
          }

          .qs-wake-activation-ring-delayed {
            animation-delay: 825ms;
          }

          .qs-wake-activation-core {
            animation: qs-wake-activation-core-pulse 1200ms ease-in-out infinite;
          }

          .qs-wake-activation-copy {
            animation: qs-wake-activation-copy-in 240ms ease-out forwards;
          }

          .qs-wake-activation-bar {
            animation: qs-wake-activation-bar 900ms ease-in-out infinite;
            transform-origin: center bottom;
          }

          .qs-wake-activation-dot {
            animation: qs-wake-activation-dot 1000ms ease-in-out infinite;
          }

          .qs-wake-activation-shell-reduced .qs-wake-activation-halo,
          .qs-wake-activation-shell-reduced .qs-wake-activation-core,
          .qs-wake-activation-shell-reduced .qs-wake-activation-copy {
            animation-duration: 180ms;
          }

          .qs-wake-activation-ring-reduced,
          .qs-wake-activation-shell-reduced .qs-wake-activation-ring,
          .qs-wake-activation-shell-reduced .qs-wake-activation-ring-delayed {
            animation: none;
            opacity: 0;
          }
        `}
      </style>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-14 sm:pt-16">
        <div
          className={`${shellClassName} relative overflow-hidden rounded-[22px] border border-emerald-400/20 bg-[linear-gradient(180deg,rgba(249,253,251,0.96),rgba(241,249,245,0.92))] px-4 py-3 shadow-[0_18px_44px_rgba(15,76,59,0.12)] backdrop-blur-xl dark:border-emerald-200/15 dark:bg-[linear-gradient(180deg,rgba(10,27,24,0.95),rgba(10,31,28,0.92))]`}
          role="status"
          aria-live="polite"
        >
          <div className="qs-wake-activation-halo absolute inset-x-10 top-1 h-14 rounded-full bg-[radial-gradient(circle,rgba(54,191,141,0.22),rgba(54,191,141,0.04)_58%,transparent_78%)] blur-2xl dark:bg-[radial-gradient(circle,rgba(93,255,195,0.18),rgba(93,255,195,0.03)_58%,transparent_78%)]" />
          <div className="relative flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center">
              <span className={ringClassName + ' absolute inset-0 rounded-full border border-emerald-400/30'} />
              <span className={ringClassName + ' qs-wake-activation-ring-delayed absolute inset-0 rounded-full border border-emerald-300/25'} />
              <div className="qs-wake-activation-core relative flex h-11 w-11 items-center justify-center rounded-full border border-white/65 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.98),rgba(218,244,233,0.96)_52%,rgba(187,232,214,0.92))] text-emerald-700 shadow-[0_8px_20px_rgba(34,139,103,0.18)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_30%_30%,rgba(25,74,60,0.98),rgba(16,48,40,0.96)_52%,rgba(11,34,29,0.94))] dark:text-emerald-200 dark:shadow-[0_10px_22px_rgba(0,0,0,0.24)]">
                <MicrophoneIcon className="h-5 w-5" />
              </div>
            </div>
            <div className="qs-wake-activation-copy min-w-0">
              <div className="text-[13px] font-semibold tracking-[0.01em] text-emerald-900 dark:text-emerald-100">
                {i18nService.t('wakeActivationOverlayTitle')}
              </div>
              <div className="mt-0.5 text-[12px] leading-snug text-emerald-800/72 dark:text-emerald-100/70">
                {i18nService.t(subtitleKey)}
              </div>
              {showTranscript && (
                <div className="mt-2 max-w-[min(56vw,34rem)] rounded-2xl border border-emerald-500/10 bg-white/60 px-3 py-2 text-[12px] leading-5 text-emerald-950/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:border-emerald-200/10 dark:bg-white/5 dark:text-emerald-50/88">
                  {trimmedTranscript}
                </div>
              )}
              {showDictatingBars && (
                <div className="mt-2 flex h-6 items-end gap-1">
                  <span className="qs-wake-activation-bar h-3 w-1 rounded-full bg-emerald-500/70" />
                  <span className="qs-wake-activation-bar h-5 w-1 rounded-full bg-emerald-500/85" style={{ animationDelay: '120ms' }} />
                  <span className="qs-wake-activation-bar h-4 w-1 rounded-full bg-emerald-400/80" style={{ animationDelay: '240ms' }} />
                  <span className="qs-wake-activation-bar h-6 w-1 rounded-full bg-emerald-500/90" style={{ animationDelay: '360ms' }} />
                </div>
              )}
              {showSubmittingDots && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="qs-wake-activation-dot h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
                  <span className="qs-wake-activation-dot h-1.5 w-1.5 rounded-full bg-emerald-500/80" style={{ animationDelay: '140ms' }} />
                  <span className="qs-wake-activation-dot h-1.5 w-1.5 rounded-full bg-emerald-500/80" style={{ animationDelay: '280ms' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default WakeActivationOverlay;
