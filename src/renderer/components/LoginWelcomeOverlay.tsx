import React, { useEffect, useMemo, useState } from 'react';
import { i18nService } from '../services/i18n';

const LOGIN_WELCOME_DURATION_MS = 2300;
const LOGIN_WELCOME_REDUCED_DURATION_MS = 1400;

type LoginWelcomeOverlayProps = {
  onClose: () => void;
};

const LoginWelcomeOverlay: React.FC<LoginWelcomeOverlayProps> = ({ onClose }) => {
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

  useEffect(() => {
    const timer = window.setTimeout(
      onClose,
      prefersReducedMotion ? LOGIN_WELCOME_REDUCED_DURATION_MS : LOGIN_WELCOME_DURATION_MS
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [onClose, prefersReducedMotion]);

  const shellClassName = useMemo(
    () => (
      prefersReducedMotion
        ? 'qs-login-welcome-shell qs-login-welcome-shell-reduced'
        : 'qs-login-welcome-shell'
    ),
    [prefersReducedMotion]
  );

  return (
    <>
      <style>
        {`
          @keyframes qs-login-welcome-fade {
            0% { opacity: 0; transform: translate3d(0, 18px, 0) scale(0.986); }
            14% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
            84% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
            100% { opacity: 0; transform: translate3d(0, -12px, 0) scale(1.008); }
          }

          @keyframes qs-login-welcome-halo {
            0% { opacity: 0; transform: scale(0.9); }
            22% { opacity: 0.5; transform: scale(1); }
            74% { opacity: 0.38; transform: scale(1.02); }
            100% { opacity: 0; transform: scale(1.05); }
          }

          @keyframes qs-login-welcome-antenna-left {
            0% { opacity: 0; transform: translate3d(-16px, -10px, 0) rotate(-7deg); }
            22% { opacity: 1; transform: translate3d(0, 0, 0) rotate(0deg); }
            58% { opacity: 1; transform: translate3d(0, 0, 0) rotate(0deg); }
            80% { opacity: 0.82; transform: translate3d(6px, 3px, 0) rotate(4deg); }
            100% { opacity: 0; transform: translate3d(10px, 7px, 0) rotate(6deg); }
          }

          @keyframes qs-login-welcome-antenna-right {
            0% { opacity: 0; transform: translate3d(16px, -10px, 0) rotate(7deg); }
            22% { opacity: 1; transform: translate3d(0, 0, 0) rotate(0deg); }
            58% { opacity: 1; transform: translate3d(0, 0, 0) rotate(0deg); }
            80% { opacity: 0.82; transform: translate3d(-6px, 3px, 0) rotate(-4deg); }
            100% { opacity: 0; transform: translate3d(-10px, 7px, 0) rotate(-6deg); }
          }

          @keyframes qs-login-welcome-body {
            0% { opacity: 0; stroke-dashoffset: 520; transform: translate3d(-12px, 6px, 0) scale(0.99); }
            24% { opacity: 1; stroke-dashoffset: 0; transform: translate3d(0, 0, 0) scale(1); }
            62% { opacity: 1; stroke-dashoffset: 0; transform: translate3d(0, 0, 0) scale(1); }
            82% { opacity: 0.94; stroke-dashoffset: 0; transform: translate3d(8px, -1px, 0) scale(1); }
            100% { opacity: 0; stroke-dashoffset: -110; transform: translate3d(18px, -4px, 0) scale(1.01); }
          }

          @keyframes qs-login-welcome-tail {
            0% { opacity: 0; transform: translate3d(-10px, 8px, 0) rotate(-3deg) scale(0.97); }
            32% { opacity: 0.92; transform: translate3d(0, 0, 0) rotate(0deg) scale(1); }
            64% { opacity: 1; transform: translate3d(0, 0, 0) rotate(0deg) scale(1); }
            84% { opacity: 0.92; transform: translate3d(14px, -2px, 0) rotate(7deg) scale(1.02); }
            100% { opacity: 0; transform: translate3d(22px, -4px, 0) rotate(10deg) scale(1.03); }
          }

          @keyframes qs-login-welcome-plate {
            0% { opacity: 0; transform: translate3d(-7px, 5px, 0) scale(0.97); }
            30% { opacity: 0.18; transform: translate3d(0, 0, 0) scale(1); }
            62% { opacity: 0.3; transform: translate3d(0, 0, 0) scale(1); }
            82% { opacity: 0.2; transform: translate3d(5px, -2px, 0) scale(1.01); }
            100% { opacity: 0; transform: translate3d(8px, -4px, 0) scale(1.02); }
          }

          @keyframes qs-login-welcome-glint {
            0% { opacity: 0; transform: translate3d(-22px, 8px, 0) rotate(-8deg); }
            34% { opacity: 0; transform: translate3d(-10px, 4px, 0) rotate(-5deg); }
            48% { opacity: 0.55; transform: translate3d(0, 0, 0) rotate(-1deg); }
            70% { opacity: 0.4; transform: translate3d(14px, -3px, 0) rotate(3deg); }
            100% { opacity: 0; transform: translate3d(28px, -7px, 0) rotate(8deg); }
          }

          @keyframes qs-login-welcome-copy {
            0% { opacity: 0; transform: translate3d(0, 8px, 0); }
            34% { opacity: 1; transform: translate3d(0, 0, 0); }
            84% { opacity: 1; transform: translate3d(0, 0, 0); }
            100% { opacity: 0; transform: translate3d(0, -5px, 0); }
          }

          .qs-login-welcome-shell {
            animation: qs-login-welcome-fade 2300ms cubic-bezier(0.19, 1, 0.22, 1) forwards;
          }

          .qs-login-welcome-shell-reduced {
            animation-duration: 1400ms;
          }

          .qs-login-welcome-halo {
            animation: qs-login-welcome-halo 2300ms cubic-bezier(0.19, 1, 0.22, 1) forwards;
          }

          .qs-login-welcome-antenna-left {
            animation: qs-login-welcome-antenna-left 2300ms cubic-bezier(0.19, 1, 0.22, 1) forwards;
          }

          .qs-login-welcome-antenna-right {
            animation: qs-login-welcome-antenna-right 2300ms cubic-bezier(0.19, 1, 0.22, 1) forwards;
          }

          .qs-login-welcome-body {
            stroke-dasharray: 520;
            animation: qs-login-welcome-body 2300ms cubic-bezier(0.19, 1, 0.22, 1) forwards;
          }

          .qs-login-welcome-tail {
            animation: qs-login-welcome-tail 2300ms cubic-bezier(0.19, 1, 0.22, 1) forwards;
          }

          .qs-login-welcome-plate {
            animation: qs-login-welcome-plate 2300ms cubic-bezier(0.19, 1, 0.22, 1) forwards;
          }

          .qs-login-welcome-glint {
            animation: qs-login-welcome-glint 2300ms cubic-bezier(0.19, 1, 0.22, 1) forwards;
          }

          .qs-login-welcome-copy {
            animation: qs-login-welcome-copy 2300ms cubic-bezier(0.19, 1, 0.22, 1) forwards;
          }

          .qs-login-welcome-shell-reduced .qs-login-welcome-halo,
          .qs-login-welcome-shell-reduced .qs-login-welcome-antenna-left,
          .qs-login-welcome-shell-reduced .qs-login-welcome-antenna-right,
          .qs-login-welcome-shell-reduced .qs-login-welcome-body,
          .qs-login-welcome-shell-reduced .qs-login-welcome-tail,
          .qs-login-welcome-shell-reduced .qs-login-welcome-plate,
          .qs-login-welcome-shell-reduced .qs-login-welcome-glint,
          .qs-login-welcome-shell-reduced .qs-login-welcome-copy {
            animation-duration: 1400ms;
          }

          .qs-login-welcome-shell-reduced .qs-login-welcome-antenna-left,
          .qs-login-welcome-shell-reduced .qs-login-welcome-antenna-right,
          .qs-login-welcome-shell-reduced .qs-login-welcome-body,
          .qs-login-welcome-shell-reduced .qs-login-welcome-tail {
            animation-name: qs-login-welcome-fade;
          }

          .qs-login-welcome-shell-reduced .qs-login-welcome-plate {
            animation-name: qs-login-welcome-halo;
          }

          .qs-login-welcome-shell-reduced .qs-login-welcome-glint {
            animation-name: qs-login-welcome-copy;
          }
        `}
      </style>
      <div className="pointer-events-none fixed inset-0 z-[110] flex items-start justify-center px-6 pt-20 sm:pt-24">
        <div className={`${shellClassName} relative w-[min(27rem,90vw)] overflow-hidden rounded-[28px] border border-emerald-400/10 bg-[linear-gradient(180deg,rgba(245,252,249,0.95),rgba(236,246,243,0.9))] px-5 pb-4 pt-4 shadow-[0_24px_64px_rgba(8,43,34,0.12)] backdrop-blur-xl dark:border-emerald-200/10 dark:bg-[linear-gradient(180deg,rgba(8,26,23,0.94),rgba(10,31,28,0.9))]`}>
          <div className="qs-login-welcome-halo absolute inset-x-14 top-5 h-20 rounded-full bg-[radial-gradient(circle,rgba(77,200,171,0.16),rgba(77,200,171,0.04)_48%,transparent_78%)] blur-2xl dark:bg-[radial-gradient(circle,rgba(110,244,208,0.12),rgba(110,244,208,0.02)_48%,transparent_78%)]" />
          <div className="relative flex flex-col items-center text-center">
            <div className="relative h-[156px] w-full max-w-[21.5rem]">
              <svg
                viewBox="0 0 380 180"
                className="h-full w-full overflow-visible"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  className="qs-login-welcome-antenna-left"
                  d="M118 80C104 53 78 37 48 32"
                  stroke="url(#qs-login-antenna-left)"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                />
                <path
                  className="qs-login-welcome-antenna-right"
                  d="M135 77C138 48 157 27 185 17"
                  stroke="url(#qs-login-antenna-right)"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                />
                <path
                  className="qs-login-welcome-body"
                  d="M116 95C127 67 149 52 173 54C198 56 213 74 210 92C207 109 191 118 173 117C153 116 142 101 147 86C151 73 167 67 184 69C209 72 233 87 253 101C272 114 292 123 312 121C328 119 341 111 350 99"
                  stroke="url(#qs-login-body)"
                  strokeWidth="6.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  className="qs-login-welcome-tail"
                  d="M286 112C305 111 321 118 335 131M285 113C300 124 309 141 307 158M286 109C307 102 329 105 347 118"
                  stroke="url(#qs-login-tail)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  className="qs-login-welcome-plate"
                  d="M147 84C157 79 166 78 176 81M166 98C177 93 187 92 197 95M188 109C199 104 209 103 219 106M211 117C221 113 230 112 240 114"
                  stroke="url(#qs-login-plate)"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
                <path
                  className="qs-login-welcome-glint"
                  d="M138 75C159 69 192 72 224 90C242 100 259 107 277 109"
                  stroke="url(#qs-login-glint)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  className="qs-login-welcome-plate"
                  d="M122 95C128 87 137 82 148 81"
                  stroke="url(#qs-login-plate-soft)"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                />
                <path
                  className="qs-login-welcome-tail"
                  d="M282 108C292 102 304 99 317 100"
                  stroke="url(#qs-login-tail-soft)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="qs-login-antenna-left" x1="48" y1="32" x2="120" y2="82" gradientUnits="userSpaceOnUse">
                    <stop stopColor="rgba(145,245,223,0)" />
                    <stop offset="0.54" stopColor="#7ADFCC" />
                    <stop offset="1" stopColor="#BDEEDF" />
                  </linearGradient>
                  <linearGradient id="qs-login-antenna-right" x1="185" y1="17" x2="135" y2="78" gradientUnits="userSpaceOnUse">
                    <stop stopColor="rgba(145,245,223,0)" />
                    <stop offset="0.6" stopColor="#72DDC7" />
                    <stop offset="1" stopColor="#D4F7EE" />
                  </linearGradient>
                  <linearGradient id="qs-login-body" x1="118" y1="73" x2="344" y2="122" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#8BE7D0" />
                    <stop offset="0.48" stopColor="#42C9A8" />
                    <stop offset="0.82" stopColor="#1F9078" />
                    <stop offset="1" stopColor="#D5B16D" />
                  </linearGradient>
                  <linearGradient id="qs-login-tail" x1="284" y1="110" x2="347" y2="152" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#5FD6B8" />
                    <stop offset="0.66" stopColor="#42AE95" />
                    <stop offset="1" stopColor="#D9B06C" />
                  </linearGradient>
                  <linearGradient id="qs-login-tail-soft" x1="282" y1="102" x2="317" y2="102" gradientUnits="userSpaceOnUse">
                    <stop stopColor="rgba(136,241,219,0.18)" />
                    <stop offset="1" stopColor="rgba(244,211,141,0.36)" />
                  </linearGradient>
                  <linearGradient id="qs-login-plate" x1="147" y1="81" x2="241" y2="114" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#F5D89A" />
                    <stop offset="0.5" stopColor="#B0EADA" />
                    <stop offset="1" stopColor="#EFC684" />
                  </linearGradient>
                  <linearGradient id="qs-login-plate-soft" x1="122" y1="95" x2="148" y2="81" gradientUnits="userSpaceOnUse">
                    <stop stopColor="rgba(240,224,187,0.12)" />
                    <stop offset="1" stopColor="rgba(167,234,215,0.36)" />
                  </linearGradient>
                  <linearGradient id="qs-login-glint" x1="138" y1="75" x2="277" y2="109" gradientUnits="userSpaceOnUse">
                    <stop stopColor="rgba(253,240,199,0)" />
                    <stop offset="0.46" stopColor="rgba(255,243,204,0.68)" />
                    <stop offset="0.78" stopColor="rgba(255,226,154,0.52)" />
                    <stop offset="1" stopColor="rgba(255,226,154,0)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-x-16 bottom-3 h-7 rounded-full bg-[radial-gradient(circle,rgba(80,211,180,0.12),rgba(80,211,180,0.03)_45%,transparent_78%)] blur-xl dark:bg-[radial-gradient(circle,rgba(110,244,208,0.1),rgba(110,244,208,0.02)_45%,transparent_78%)]" />
            </div>
            <div className="qs-login-welcome-copy mt-1">
              <div className="text-[0.95rem] font-semibold tracking-[0.12em] text-slate-900 dark:text-white">
                {i18nService.t('authLoginWelcomeTitle')}
              </div>
              <div className="mt-1 text-[10px] font-medium tracking-[0.24em] text-emerald-950/46 dark:text-emerald-100/42">
                {i18nService.t('authLoginWelcomeSubtitle')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginWelcomeOverlay;
