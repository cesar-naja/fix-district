import type { DeviceId } from "@/lib/site";

type DeviceIllustrationProps = {
  device: DeviceId;
  className?: string;
};

/**
 * Line-art device drawings in the brand's workbench style: charcoal outline,
 * one rust accent for the "service point" on each device. Decorative only.
 */
export function DeviceIllustration({
  device,
  className = "",
}: DeviceIllustrationProps) {
  return (
    <svg
      viewBox="0 0 200 150"
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Bench shadow line, shared by all devices. */}
      <path d="M20 138h160" strokeWidth="2" opacity="0.35" />
      {device === "phones" && <Phone />}
      {device === "laptops" && <Laptop />}
      {device === "tablets" && <Tablet />}
      {device === "consoles" && <Controller />}
    </svg>
  );
}

const ACCENT = "var(--accent)";

function Phone() {
  return (
    <g>
      <rect x="66" y="12" width="68" height="120" rx="12" />
      <rect x="73" y="26" width="54" height="86" rx="3" strokeWidth="2" />
      <path d="M90 19h20" strokeWidth="2.5" />
      <path d="M92 122h16" strokeWidth="2.5" />
      {/* Accent: a hairline fault across the glass, the thing we diagnose. */}
      <path d="M73 52l16 10 8-8 14 14 16-4" stroke={ACCENT} strokeWidth="2.5" />
      <circle cx="97" cy="54" r="2.2" fill={ACCENT} stroke="none" />
    </g>
  );
}

function Laptop() {
  return (
    <g>
      <rect x="40" y="26" width="120" height="78" rx="6" />
      <rect x="48" y="34" width="104" height="62" rx="2" strokeWidth="2" />
      <path d="M22 116h156l-8 14H30z" />
      <path d="M88 122h24" strokeWidth="2.5" />
      {/* Accent: a small screw/service panel on the lid corner. */}
      <circle cx="140" cy="46" r="6" stroke={ACCENT} strokeWidth="2.5" />
      <path d="M137 49l6-6" stroke={ACCENT} strokeWidth="2.5" />
    </g>
  );
}

function Tablet() {
  return (
    <g>
      <rect x="40" y="16" width="120" height="112" rx="12" />
      <rect x="50" y="26" width="100" height="92" rx="3" strokeWidth="2" />
      <circle cx="100" cy="21" r="1.8" fill="currentColor" stroke="none" />
      {/* Accent: a battery outline inside, the part that wears out. */}
      <rect x="78" y="58" width="44" height="22" rx="3" stroke={ACCENT} strokeWidth="2.5" />
      <path d="M122 65v8" stroke={ACCENT} strokeWidth="3" />
      <path d="M86 69h10" stroke={ACCENT} strokeWidth="2.5" />
    </g>
  );
}

function Controller() {
  return (
    <g>
      <path d="M52 40h96c18 0 32 28 32 54 0 14-8 24-20 24-11 0-18-8-24-18H64c-6 10-13 18-24 18-12 0-20-10-20-24 0-26 14-54 32-54z" />
      {/* D-pad */}
      <path d="M62 66h22M73 55v22" strokeWidth="4" />
      {/* Buttons */}
      <circle cx="134" cy="62" r="5" />
      <circle cx="148" cy="74" r="5" />
      <circle cx="120" cy="74" r="5" />
      {/* Accent: the port/connector row that tends to fail. */}
      <path d="M88 52h24" stroke={ACCENT} strokeWidth="3" />
      <circle cx="100" cy="92" r="3" fill={ACCENT} stroke="none" />
    </g>
  );
}
