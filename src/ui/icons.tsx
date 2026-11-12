/** Eigene Linien-Icons (24×24, 1,6 px Strich) – bewusst ruhig und einheitlich. */
import type { JSX } from 'preact';
import type { Sport } from '../lib/types';

type P = { size?: number; class?: string; strokeWidth?: number };

function Svg({ size = 24, strokeWidth = 1.6, class: cls, children }: P & { children: JSX.Element | JSX.Element[] }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={strokeWidth}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class={cls}
    >
      {children}
    </svg>
  );
}

export const IconOverview = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </Svg>
);
export const IconHistory = (p: P) => (
  <Svg {...p}>
    <path d="M8 6.5h12M8 12h12M8 17.5h12" />
    <circle cx="4.25" cy="6.5" r=".6" fill="currentColor" />
    <circle cx="4.25" cy="12" r=".6" fill="currentColor" />
    <circle cx="4.25" cy="17.5" r=".6" fill="currentColor" />
  </Svg>
);
export const IconSettings = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Svg>
);
export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconMinus = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);
export const IconBouldern = (p: P) => (
  <Svg {...p}>
    <path d="M6.2 15.8c-1.6-2.9-.4-6.9 2.6-8.8 2.6-1.7 6.6-1.9 8.6.3 1.9 2.1 1.2 5.1-.5 7.2-1.8 2.2-4.2 3.9-6.8 3.7-1.7-.1-3.1-1-3.9-2.4z" />
    <circle cx="12.4" cy="12" r="1.4" />
  </Svg>
);
export const IconKraft = (p: P) => (
  <Svg {...p}>
    <path d="M8.5 12h7" />
    <rect x="5" y="7.5" width="3.5" height="9" rx="1.2" />
    <rect x="15.5" y="7.5" width="3.5" height="9" rx="1.2" />
    <path d="M3 10.5v3M21 10.5v3" />
  </Svg>
);
export const IconLaufen = (p: P) => (
  <Svg {...p}>
    <path d="M4 18.5c3.5 0 3.5-4 7-4s3.5-6 7-6" />
    <circle cx="4" cy="18.5" r="1.3" />
    <circle cx="19.5" cy="8.5" r="1.8" />
  </Svg>
);
export const IconChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="M14.5 5.5L8 12l6.5 6.5" />
  </Svg>
);
export const IconChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="M9.5 5.5L16 12l-6.5 6.5" />
  </Svg>
);
export const IconChevronDown = (p: P) => (
  <Svg {...p}>
    <path d="M6 9.5l6 6 6-6" />
  </Svg>
);
export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 7h15M10 4.5h4M6.5 7l.8 11.2a1.8 1.8 0 001.8 1.6h5.8a1.8 1.8 0 001.8-1.6L17.5 7M10 11v5M14 11v5" />
  </Svg>
);
export const IconCopy = (p: P) => (
  <Svg {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
    <path d="M15.5 8.5V6.5a2 2 0 00-2-2h-7a2 2 0 00-2 2v7a2 2 0 002 2h2" />
  </Svg>
);
export const IconMore = (p: P) => (
  <Svg {...p}>
    <circle cx="6" cy="12" r=".9" fill="currentColor" />
    <circle cx="12" cy="12" r=".9" fill="currentColor" />
    <circle cx="18" cy="12" r=".9" fill="currentColor" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </Svg>
);
export const IconCalendar = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="5.5" width="16" height="14.5" rx="3" />
    <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
  </Svg>
);
export const IconFlame = (p: P) => (
  <Svg {...p}>
    <path d="M12 20.5c3.6 0 6-2.4 6-5.8 0-3.9-3.2-5.9-4.2-9.7-2.6 1.6-3.6 4-3.5 6.2-1.2-.6-1.9-1.7-2.1-2.9C6.9 9.8 6 11.9 6 14.7c0 3.4 2.4 5.8 6 5.8z" />
  </Svg>
);
export const IconTrophy = (p: P) => (
  <Svg {...p}>
    <path d="M8 4.5h8v5a4 4 0 01-8 0v-5zM8 6.5H5a3 3 0 003 4M16 6.5h3a3 3 0 01-3 4M12 13.5v3.5M8.5 20h7M9.5 17h5" />
  </Svg>
);
export const IconUpload = (p: P) => (
  <Svg {...p}>
    <path d="M12 15V4.5M7.5 9L12 4.5 16.5 9M5 15v2.5A2.5 2.5 0 007.5 20h9a2.5 2.5 0 002.5-2.5V15" />
  </Svg>
);
export const IconDownload = (p: P) => (
  <Svg {...p}>
    <path d="M12 4.5V15M7.5 10.5L12 15l4.5-4.5M5 15v2.5A2.5 2.5 0 007.5 20h9a2.5 2.5 0 002.5-2.5V15" />
  </Svg>
);
export const IconTable = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="4.5" width="16" height="15" rx="2.5" />
    <path d="M4 9.5h16M4 14.5h16M10 9.5v10" />
  </Svg>
);
export const IconShield = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.8l7 2.7v5c0 4.4-3 7.8-7 8.9-4-1.1-7-4.5-7-8.9v-5l7-2.7z" />
    <path d="M9 12l2.2 2.2L15.5 10" />
  </Svg>
);
export const IconPin = (p: P) => (
  <Svg {...p}>
    <path d="M12 20.5s6-5.4 6-10.2a6 6 0 00-12 0c0 4.8 6 10.2 6 10.2z" />
    <circle cx="12" cy="10.3" r="2.2" />
  </Svg>
);
export const IconMerge = (p: P) => (
  <Svg {...p}>
    <path d="M6 4.5v4a4 4 0 004 4h8M18 12.5l-3-3M18 12.5l-3 3M6 19.5v-4" />
  </Svg>
);
export const IconEdit = (p: P) => (
  <Svg {...p}>
    <path d="M15.5 5.5l3 3L9 18H6v-3l9.5-9.5z" />
  </Svg>
);
export const IconInfo = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5M12 7.8v.2" />
  </Svg>
);
export const IconAlert = (p: P) => (
  <Svg {...p}>
    <path d="M12 4.5l8.5 15h-17L12 4.5z" />
    <path d="M12 10v4.5M12 17v.2" />
  </Svg>
);
export const IconSun = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.8" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
  </Svg>
);

export const SPORT_ICON: Record<Sport, (p: P) => JSX.Element> = {
  bouldern: IconBouldern,
  kraft: IconKraft,
  laufen: IconLaufen,
};

export function SportBadge({ sport, small }: { sport: Sport; small?: boolean }) {
  const I = SPORT_ICON[sport];
  return (
    <span class={`badge ${sport}${small ? ' small' : ''}`}>
      <I size={small ? 17 : 21} />
    </span>
  );
}
