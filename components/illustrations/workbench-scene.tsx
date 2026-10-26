/**
 * Hero artwork: a top-down view of a repair bench. An opened phone on a
 * cutting mat, a screw tray, a screwdriver, and a ruler. Purely illustrative;
 * it is not a photograph of the shop and carries no information.
 */
export function WorkbenchScene({ className = "" }: { className?: string }) {
  const paper = "#f5f0e6";
  const dim = "#b9b3a6";
  const raised = "#2a2926";
  const deeper = "#34322e";
  const accent = "#f58a5b";

  const traySpots: Array<[number, number]> = [
    [452, 112],
    [486, 104],
    [520, 118],
    [468, 146],
    [506, 150],
  ];

  return (
    <svg
      viewBox="0 0 640 560"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <pattern id="mat-grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" fill="none" stroke={paper} strokeOpacity="0.07" strokeWidth="1" />
        </pattern>
        <pattern id="ruler-ticks" width="12" height="32" patternUnits="userSpaceOnUse">
          <path d="M0 0v10M6 0v6" stroke="#1c1b19" strokeWidth="1.5" />
        </pattern>
        <clipPath id="bench-clip">
          <rect width="640" height="560" rx="28" />
        </clipPath>
      </defs>

      <g clipPath="url(#bench-clip)">
        {/* Cutting mat */}
        <rect width="640" height="560" fill="#1c1b19" />
        <rect width="640" height="560" fill="url(#mat-grid)" />
        <path d="M0 0h640v560H0z" fill="none" stroke={paper} strokeOpacity="0.12" strokeWidth="2" />

        {/* Opened phone */}
        <g transform="rotate(-7 245 255)">
          <rect x="140" y="62" width="210" height="386" rx="30" fill={raised} stroke={dim} strokeWidth="3" />
          {/* Camera module */}
          <rect x="158" y="80" width="64" height="64" rx="16" fill={deeper} stroke={paper} strokeOpacity="0.7" strokeWidth="2" />
          <circle cx="178" cy="100" r="10" fill="none" stroke={paper} strokeOpacity="0.8" strokeWidth="2" />
          <circle cx="204" cy="124" r="8" fill="none" stroke={paper} strokeOpacity="0.8" strokeWidth="2" />
          {/* Logic board */}
          <path
            d="M236 84h96a10 10 0 0 1 10 10v128a10 10 0 0 1-10 10H168a10 10 0 0 1-10-10v-62h58a20 20 0 0 0 20-20z"
            fill={deeper}
            stroke={paper}
            strokeOpacity="0.55"
            strokeWidth="2"
          />
          <rect x="250" y="102" width="34" height="34" rx="4" fill="none" stroke={accent} strokeWidth="2.5" />
          <rect x="294" y="102" width="26" height="20" rx="3" fill="none" stroke={paper} strokeOpacity="0.6" strokeWidth="2" />
          <rect x="250" y="150" width="70" height="14" rx="3" fill="none" stroke={paper} strokeOpacity="0.45" strokeWidth="2" />
          <path d="M262 190h56M262 200h40" stroke={paper} strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
          {/* Battery */}
          <rect x="158" y="246" width="184" height="170" rx="12" fill={raised} stroke={paper} strokeOpacity="0.7" strokeWidth="2.5" />
          <path d="M184 276h132M184 296h132M184 316h90" stroke={paper} strokeOpacity="0.18" strokeWidth="2" strokeLinecap="round" />
          <rect x="280" y="380" width="46" height="22" rx="3" fill="none" stroke={accent} strokeWidth="2.5" />
          <path d="M303 380v-22" stroke={accent} strokeWidth="2.5" />
          {/* Flex cable from battery connector up to the board */}
          <path d="M303 358c0-40-24-48-24-80" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeDasharray="1 7" />
          {/* Screws */}
          {([
            [152, 232],
            [348, 232],
            [152, 430],
            [348, 430],
          ] as Array<[number, number]>).map(([x, y]) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
              <circle r="7" fill={paper} fillOpacity="0.85" />
              <path d="M-4.5 0h9" stroke="#1c1b19" strokeWidth="2" strokeLinecap="round" />
            </g>
          ))}
        </g>

        {/* Screw tray */}
        <g>
          <rect x="412" y="70" width="156" height="118" rx="16" fill={raised} stroke={dim} strokeWidth="2.5" />
          <rect x="424" y="82" width="132" height="94" rx="10" fill="#1c1b19" stroke={paper} strokeOpacity="0.2" strokeWidth="2" />
          {traySpots.map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y}) rotate(${i * 37})`}>
              <circle r="7" fill={i === 2 ? accent : paper} fillOpacity={i === 2 ? 1 : 0.85} />
              <path d="M-4.5 0h9" stroke="#1c1b19" strokeWidth="2" strokeLinecap="round" />
            </g>
          ))}
        </g>

        {/* Screwdriver */}
        <g transform="translate(372 478) rotate(-26)">
          <rect x="0" y="-15" width="118" height="30" rx="15" fill={accent} />
          <path d="M18 -9v18M38 -9v18M58 -9v18" stroke="#1c1b19" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />
          <rect x="118" y="-9" width="26" height="18" rx="3" fill={dim} />
          <rect x="144" y="-3.5" width="104" height="7" fill={paper} fillOpacity="0.9" />
          <path d="M248 -3.5l12 3.5-12 3.5z" fill={paper} fillOpacity="0.9" />
        </g>

        {/* Pry tool */}
        <g transform="translate(430 250) rotate(18)">
          <rect x="0" y="-6" width="96" height="12" rx="6" fill={dim} />
          <path d="M96 -6l30 6-30 6z" fill={dim} />
        </g>

        {/* Ruler */}
        <rect x="0" y="516" width="640" height="44" fill={paper} />
        <rect x="0" y="516" width="640" height="32" fill="url(#ruler-ticks)" />
        <rect x="0" y="516" width="640" height="3" fill="#1c1b19" fillOpacity="0.2" />
      </g>
    </svg>
  );
}
