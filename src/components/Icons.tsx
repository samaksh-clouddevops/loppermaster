import type { ReactNode } from 'react';

function Svg({ children, className = 'icon' }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

export function IconPlay({ className = 'icon icon-play' }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M8.2 5.4v13.2L18.8 12 8.2 5.4z" fill="currentColor" />
    </Svg>
  );
}

export function IconPause() {
  return (
    <Svg>
      <path d="M7 5h3.2v14H7V5zm6.8 0H17v14h-3.2V5z" fill="currentColor" />
    </Svg>
  );
}

export function IconSkipBack() {
  return (
    <Svg>
      <path d="M7 6h2v12H7V6zm3.2 6 7.3 5.2V6.8L10.2 12z" fill="currentColor" />
    </Svg>
  );
}

export function IconSkipForward() {
  return (
    <Svg>
      <path d="M15 6h2v12h-2V6zM6.5 6.8v10.4L13.8 12 6.5 6.8z" fill="currentColor" />
    </Svg>
  );
}

export function IconVolume() {
  return (
    <Svg>
      <path
        d="M4 9.5h3.2L11 6.2v11.6l-3.8-3.3H4v-5zm9.2-2.1a5 5 0 0 1 0 9.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconVolumeMuted() {
  return (
    <Svg>
      <path
        d="M4 9.5h3.2L11 6.2v11.6l-3.8-3.3H4v-5zm9 1.2 5 5m0-5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconFullscreen() {
  return (
    <Svg>
      <path
        d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconExitFullscreen() {
  return (
    <Svg>
      <path
        d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconSettings() {
  return (
    <Svg>
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M5.8 5.8l1.6 1.6M16.6 16.6l1.6 1.6M18.2 5.8l-1.6 1.6M7.4 16.6l-1.6 1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconRepeat() {
  return (
    <Svg>
      <path
        d="M7 7h9.2a3 3 0 0 1 3 3v1M17 17H7.8a3 3 0 0 1-3-3v-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="m15 4 3.2 3L15 10M9 20l-3.2-3L9 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconSpeed() {
  return (
    <Svg>
      <path
        d="M5 16a7 7 0 1 1 14 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M12 16l4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function IconBookmark() {
  return (
    <Svg>
      <path
        d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.2L6 20V5.5a1 1 0 0 1 1-1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconClose() {
  return (
    <Svg>
      <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}
