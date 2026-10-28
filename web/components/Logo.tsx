export function LogoMark({ className = "h-9 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 110" fill="none" className={className} aria-hidden="true">
      {/* open book pages (amber) */}
      <path
        d="M56 78 C72 62 98 60 114 66 L120 94 C102 90 78 92 62 102 Z"
        stroke="#F6B93B"
        strokeWidth="7"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M66 88 C80 78 98 76 110 79"
        stroke="#F6B93B"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      {/* teal swoosh under book */}
      <path
        d="M38 97 C66 110 104 108 128 96"
        stroke="#12808C"
        strokeWidth="8"
        strokeLinecap="round"
        fill="none"
      />
      {/* dove wing */}
      <path
        d="M14 64 C8 30 30 6 62 12 C46 18 36 33 39 50 C52 43 64 44 72 53"
        stroke="#2F6CB3"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* dove head/beak + chest */}
      <path
        d="M72 53 C80 55 84 63 78 70"
        stroke="#2F6CB3"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M60 62 C58 74 52 82 44 88"
        stroke="#2F6CB3"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
      {/* magnifier */}
      <circle cx="100" cy="30" r="12" stroke="#1E4172" strokeWidth="6" fill="none" />
      <path d="M109 40 L118 51" stroke="#1E4172" strokeWidth="6" strokeLinecap="round" />
      {/* sparkle */}
      <path
        d="M124 14 L127 8 M132 22 L138 19 M126 26 L133 28"
        stroke="#F6B93B"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-bold leading-none ${className}`}>
      <span className="text-[#1E4172]">Begrijpend </span>
      <span className="text-[#12808C]">Le</span>
      <span className="text-[#F6B93B]">zen</span>
    </span>
  );
}

export function Logo({ markClass = "h-9 w-auto", textClass = "text-xl" }: { markClass?: string; textClass?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark className={markClass} />
      <BrandWordmark className={textClass} />
    </span>
  );
}
