import React from 'react';

const DefaultAgentIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#default-agent-fill)" />
    <path
      d="M7.2 15.8h9.6M7.2 12h9.6M7.2 8.2h9.6"
      stroke="white"
      strokeWidth="1.55"
      strokeLinecap="round"
    />
    <circle cx="16.8" cy="8.2" r="1.65" fill="#DDF7EE" stroke="white" strokeWidth="1.1" />
    <defs>
      <linearGradient id="default-agent-fill" x1="3.5" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
        <stop stopColor="#20C997" />
        <stop offset="0.52" stopColor="#0EA5A4" />
        <stop offset="1" stopColor="#2563EB" />
      </linearGradient>
    </defs>
  </svg>
);

export default DefaultAgentIcon;
