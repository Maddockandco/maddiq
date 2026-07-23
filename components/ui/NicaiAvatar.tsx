export default function NicaiAvatar({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="nicai-hair" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e88fc2" />
          <stop offset="1" stopColor="#a06fd1" />
        </linearGradient>
        <linearGradient id="nicai-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Face - warm, soft */}
      <rect x="4" y="4" width="56" height="56" rx="24" fill="#fbe4c8" />

      {/* Pigtail buns */}
      <circle cx="8" cy="24" r="8" fill="url(#nicai-hair)" />
      <circle cx="56" cy="24" r="8" fill="url(#nicai-hair)" />
      <circle cx="8" cy="24" r="8" fill="url(#nicai-shine)" opacity="0.5" />
      <circle cx="56" cy="24" r="8" fill="url(#nicai-shine)" opacity="0.5" />

      {/* Fringe / hair top */}
      <path
        d="M10 20c2-10 12-16 22-16s20 6 22 16c-4-3-9-4-13-2-3-3-8-4-11-1-3-3-8-2-11 1-4-2-8-1-9 2z"
        fill="url(#nicai-hair)"
      />
      <rect x="4" y="4" width="56" height="56" rx="24" fill="url(#nicai-shine)" opacity="0.25" />

      {/* Rosy cheeks - the cuteness */}
      <circle cx="18" cy="40" r="4.5" fill="#f4a4a4" opacity="0.6" />
      <circle cx="46" cy="40" r="4.5" fill="#f4a4a4" opacity="0.6" />

      {/* Big friendly eyes with sparkle */}
      <circle cx="24" cy="34" r="4.2" fill="#343b46" />
      <circle cx="40" cy="34" r="4.2" fill="#343b46" />
      <circle cx="25.5" cy="32.3" r="1.2" fill="#ffffff" />
      <circle cx="41.5" cy="32.3" r="1.2" fill="#ffffff" />

      {/* Warm, funny, open smile */}
      <path
        d="M21 43c4 5 18 5 22 0"
        stroke="#343b46"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />

      {/* Little heart accent - cuteness inside out */}
      <path
        d="M50 12c-1.2-1.4-3.4-1.4-4 .4-.6-1.8-2.8-1.8-4-.4-1.2 1.4-.2 3 4 6 4.2-3 5.2-4.6 4-6z"
        fill="#c9af69"
      />
    </svg>
  )
}
