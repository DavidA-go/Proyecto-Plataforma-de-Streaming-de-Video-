export default function AuthVisual({ heading, copy }) {
  return (
    <div className="auth-visual">
      <div className="auth-brand">
        <span className="auth-brand-mark">
          <svg viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="17" cy="17" r="16" stroke="#e9bb52" strokeWidth="1.5" />
            <path d="M14 11.5L23 17L14 22.5V11.5Z" fill="#dfbd6d" />
          </svg>
        </span>
        <span className="auth-brand-name">CineVerse</span>
      </div>

      <div className="auth-visual-art">
        <svg viewBox="0 0 420 460" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="poster1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#903054" />
              <stop offset="100%" stopColor="#55223b" />
            </linearGradient>
            <linearGradient id="poster2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#e3b23c" />
              <stop offset="100%" stopColor="#8a5a12" />
            </linearGradient>
            <linearGradient id="poster3" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#3a3550" />
              <stop offset="100%" stopColor="#1c1926" />
            </linearGradient>
            <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="#c59d3e" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#e3b23c" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle cx="210" cy="230" r="150" fill="url(#glow)" />

          <g transform="rotate(-10 130 170)">
            <rect x="60" y="90" width="140" height="200" rx="14" fill="url(#poster1)" stroke="#2b2836" />
            <rect x="76" y="106" width="108" height="6" rx="3" fill="rgba(255,255,255,0.25)" />
            <rect x="76" y="256" width="70" height="6" rx="3" fill="rgba(255,255,255,0.3)" />
          </g>

          <g transform="rotate(8 300 190)">
            <rect x="235" y="70" width="140" height="200" rx="14" fill="url(#poster3)" stroke="#2b2836" />
            <rect x="251" y="86" width="90" height="6" rx="3" fill="rgba(255,255,255,0.2)" />
            <rect x="251" y="236" width="60" height="6" rx="3" fill="rgba(255,255,255,0.25)" />
          </g>

          <g transform="rotate(-4 210 330)">
            <rect x="140" y="230" width="140" height="200" rx="14" fill="url(#poster2)" stroke="#2b2836" />
            <rect x="156" y="246" width="100" height="6" rx="3" fill="rgba(0,0,0,0.25)" />
            <rect x="156" y="396" width="66" height="6" rx="3" fill="rgba(0,0,0,0.3)" />
          </g>

          <circle cx="210" cy="225" r="46" fill="#0a0a0f" stroke="#e3b23c" strokeWidth="2" />
          <path d="M199 207L228 225L199 243V207Z" fill="#e3b23c" />
        </svg>
      </div>

      <div className="auth-visual-copy">
        <h2>{heading}</h2>
        <p>{copy}</p>
      </div>
    </div>
  );
}
