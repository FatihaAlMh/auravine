import React from "react";

interface AuravineLogoProps {
  className?: string;
}

export default function AuravineLogo({ className = "w-5 h-5" }: AuravineLogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="auravine-petal"
          x1="16"
          y1="8"
          x2="48"
          y2="54"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#f3e8ff" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <radialGradient id="auravine-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g transform="translate(32 32)">
        <path
          d="M0 -24 C7 -15 7 -4 0 0 C-7 -4 -7 -15 0 -24Z"
          fill="url(#auravine-petal)"
          opacity="0.95"
        />
        <path
          d="M0 -24 C7 -15 7 -4 0 0 C-7 -4 -7 -15 0 -24Z"
          fill="url(#auravine-petal)"
          opacity="0.85"
          transform="rotate(60)"
        />
        <path
          d="M0 -24 C7 -15 7 -4 0 0 C-7 -4 -7 -15 0 -24Z"
          fill="url(#auravine-petal)"
          opacity="0.85"
          transform="rotate(120)"
        />
        <path
          d="M0 -24 C7 -15 7 -4 0 0 C-7 -4 -7 -15 0 -24Z"
          fill="url(#auravine-petal)"
          opacity="0.85"
          transform="rotate(180)"
        />
        <path
          d="M0 -24 C7 -15 7 -4 0 0 C-7 -4 -7 -15 0 -24Z"
          fill="url(#auravine-petal)"
          opacity="0.85"
          transform="rotate(240)"
        />
        <path
          d="M0 -24 C7 -15 7 -4 0 0 C-7 -4 -7 -15 0 -24Z"
          fill="url(#auravine-petal)"
          opacity="0.85"
          transform="rotate(300)"
        />
        <circle cx="0" cy="0" r="6.5" fill="url(#auravine-core)" />
        <circle cx="0" cy="0" r="2.4" fill="#fef9c3" />
        <circle cx="-15" cy="-18" r="1.2" fill="#e9d5ff" opacity="0.85" />
        <circle cx="17" cy="-13" r="1.1" fill="#7dd3fc" opacity="0.85" />
        <circle cx="13" cy="19" r="1.2" fill="#c084fc" opacity="0.8" />
        <circle cx="-16" cy="15" r="1" fill="#fde68a" opacity="0.8" />
      </g>
    </svg>
  );
}
