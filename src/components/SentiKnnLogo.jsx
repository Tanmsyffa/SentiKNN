export default function SentiKnnLogo({ className = 'w-11 h-11' }) {
  return (
    <svg
      aria-label="Logo SentiKNN"
      className={className}
      viewBox="0 0 48 48"
      role="img"
    >
      <defs>
        <linearGradient id="sentiknn-logo-gradient" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60A5FA" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#sentiknn-logo-gradient)" />
      <path d="M13 16.5C13 13.462 15.462 11 18.5 11H29.5C32.538 11 35 13.462 35 16.5V25.5C35 28.538 32.538 31 29.5 31H23L17.2 36V31H18.5C15.462 31 13 28.538 13 25.5V16.5Z" fill="white" fillOpacity="0.96" />
      <path d="M18.2 18.5H29.8M18.2 22.5H26.8" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="30" cy="30" r="7" fill="#0F172A" stroke="white" strokeWidth="2" />
      <path d="M27.5 30H32.5M30 27.5V32.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
