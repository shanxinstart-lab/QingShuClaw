import React from 'react';

interface QingShuBrandMarkProps {
  className?: string;
  iconClassName?: string;
}

const QingShuBrandMark: React.FC<QingShuBrandMarkProps> = ({
  className = 'relative flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-500 shadow-sm shadow-emerald-500/30 ring-1 ring-emerald-300/35',
  iconClassName = 'text-[10px] font-semibold tracking-[0.08em] text-white',
}) => {
  return (
    <span className={className} aria-hidden="true">
      <span className={iconClassName}>青</span>
      <span className="absolute inset-[2px] rounded-full border border-white/18" />
    </span>
  );
};

export default QingShuBrandMark;
