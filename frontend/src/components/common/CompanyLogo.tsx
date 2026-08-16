import React from 'react';
import { useSecureFileUrl } from './SecureFile';

/**
 * Deterministic colour per company code so the fallback badge stays stable
 * across reloads and looks intentional rather than random.
 */
const BADGE_PALETTE = [
  'bg-purple-600',
  'bg-amber-500',
  'bg-emerald-600',
  'bg-sky-600',
  'bg-rose-600',
  'bg-indigo-600',
];

function paletteFor(code: string): string {
  let hash = 0;
  for (let index = 0; index < code.length; index += 1) {
    hash = (hash * 31 + code.charCodeAt(index)) % 997;
  }
  return BADGE_PALETTE[hash % BADGE_PALETTE.length];
}

interface CompanyLogoProps {
  code: string;
  name?: string;
  logoUrl?: string | null;
  /** Tailwind size classes for the square container, e.g. "w-12 h-12". */
  sizeClass?: string;
  /** Tailwind text size for the fallback badge label. */
  textClass?: string;
  className?: string;
  rounded?: string;
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  code,
  name,
  logoUrl,
  sizeClass = 'w-12 h-12',
  textClass = 'text-xs',
  className = '',
  rounded = 'rounded-xl',
}) => {
  const file = useSecureFileUrl(logoUrl);
  const label = (code || name || '?').slice(0, 4).toUpperCase();

  if (logoUrl && file.url) {
    return (
      <div
        className={`${sizeClass} ${rounded} ${className} bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0`}
      >
        <img
          src={file.url}
          alt={name ? `${name} logo` : 'Company logo'}
          className="w-full h-full object-contain p-1"
        />
      </div>
    );
  }

  // Loading a private logo: keep the layout stable with a neutral placeholder.
  if (logoUrl && file.loading) {
    return <div className={`${sizeClass} ${rounded} ${className} bg-slate-100 animate-pulse shrink-0`} />;
  }

  return (
    <div
      title={name || code}
      className={`${sizeClass} ${rounded} ${className} ${paletteFor(code || 'X')} text-white font-black ${textClass} flex items-center justify-center tracking-wider shrink-0 shadow-xs`}
    >
      {label}
    </div>
  );
};
