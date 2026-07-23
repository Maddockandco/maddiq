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
          <stop offset="0" stopColor="#f0a3d4" />
          <stop offset="1" stopColor="#9c5fd6" />
        </linearGradient>
        <linearGradient id="nicai-shine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="nicai-iris" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c98fe8" />
          <stop offset="1" stopColor="#7c4fc4" />
        </linearGradient>
      </defs>

      {/* Twin-tails, behind the head */}
      <path d="M6 26c-3 6-3 15 2 20 3-3 4-9 3-15-1-4-3-6-5-5z" fill="url(#nicai-hair)" />
      <path d="M58 26c3 6 3 15-2 20-3-3-4-9-3-15 1-4 3-6 5-5z" fill="url(#nicai-hair)" />
      <path d="M7 28c-1 4-1 9 1 13 1-3 1-8 0-12-.3-.7-.7-1-1-1z" fill="url(#nicai-shine)" opacity="0.6" />
      <path d="M57 28c1 4 1 9-1 13-1-3-1-8 0-12 .3-.7.7-1 1-1z" fill="url(#nicai-shine)" opacity="0.6" />

      {/* Face */}
      <ellipse cx="32" cy="34" rx="19" ry="20" fill="#fce3cc" />

      {/* Hair - bold fringe with a side part, glossy streak */}
      <path
        d="M12 26C12 12 20 5 32 5s20 7 20 21c-3-6-8-9-13-8-4-6-11-6-15 0-5-1-9 2-12 8z"
        fill="url(#nicai-hair)"
      />
      <path
        d="M17 22c3-6 8-9 13-9-2 4-6 8-9 11-2-1-3-1-4-2z"
        fill="url(#nicai-shine)"
        opacity="0.7"
      />

      {/* Eyebrows */}
      <path d="M20 26c2-1.5 5-1.5 7 0" stroke="#9c5fd6" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M37 26c2-1.5 5-1.5 7 0" stroke="#9c5fd6" strokeWidth="1.6" strokeLinecap="round" fill="none" />

      {/* Big anime eyes */}
      <path d="M19 31c1.5-2.5 10-2.5 11 0v6c-1.5 3-9.5 3-11 0z" fill="#ffffff" />
      <path d="M36 31c1.5-2.5 10-2.5 11 0v6c-1.5 3-9.5 3-11 0z" fill="#ffffff" />
      <ellipse cx="24.5" cy="34.5" rx="4.6" ry="5.4" fill="url(#nicai-iris)" />
      <ellipse cx="41.5" cy="34.5" rx="4.6" ry="5.4" fill="url(#nicai-iris)" />
      <ellipse cx="24.5" cy="35.5" rx="2.1" ry="2.6" fill="#2c2340" />
      <ellipse cx="41.5" cy="35.5" rx="2.1" ry="2.6" fill="#2c2340" />
      <circle cx="26.2" cy="32.2" r="1.5" fill="#ffffff" />
      <circle cx="43.2" cy="32.2" r="1.5" fill="#ffffff" />
      <circle cx="23" cy="37" r="0.8" fill="#ffffff" opacity="0.8" />
      <circle cx="40" cy="37" r="0.8" fill="#ffffff" opacity="0.8" />
      <path d="M19 31c1.5-2.3 10-2.3 11 0" stroke="#3a2d55" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M36 31c1.5-2.3 10-2.3 11 0" stroke="#3a2d55" strokeWidth="1.4" strokeLinecap="round" fill="none" />

      {/* Blush */}
      <ellipse cx="19" cy="43" rx="3.6" ry="2.2" fill="#f6a7c0" opacity="0.65" />
      <ellipse cx="46" cy="43" rx="3.6" ry="2.2" fill="#f6a7c0" opacity="0.65" />

      {/* Soft smile */}
      <path d="M27 46c2 2.4 8 2.4 10 0" stroke="#a5583f" strokeWidth="2" strokeLinecap="round" fill="none" />

      {/* Heart hair clip */}
      <path
        d="M13 16c-.9-1-2.5-1-3 .3-.5-1.3-2.1-1.3-3-.3-.9 1-.1 2.2 3 4.4 3.1-2.2 3.9-3.4 3-4.4z"
        fill="#c9af69"
      />
    </svg>
  )
}
