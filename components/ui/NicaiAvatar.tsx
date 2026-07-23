export default function NicaiAvatar({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Soft rounded body, brand gold */}
      <rect x="4" y="4" width="56" height="56" rx="22" fill="#c9af69" />
      <rect x="4" y="4" width="56" height="56" rx="22" fill="url(#nicai-shine)" opacity="0.5" />

      {/* Face */}
      <circle cx="24" cy="29" r="4" fill="#343b46" />
      <circle cx="40" cy="29" r="4" fill="#343b46" />
      <path
        d="M22 39c3.5 4 16.5 4 20 0"
        stroke="#343b46"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />

      {/* Little sparkle, echoes the ✨ used in the nav */}
      <path
        d="M50 12l1.4 3.6L55 17l-3.6 1.4L50 22l-1.4-3.6L45 17l3.6-1.4L50 12z"
        fill="#f2f7f8"
      />

      <defs>
        <linearGradient id="nicai-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}
