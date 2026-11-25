import { FC } from "react";

const R = 15;
const W = 12.5;
const P = (a: number, r = R) => [32 + r * Math.cos((a * Math.PI) / 180), 33 + r * Math.sin((a * Math.PI) / 180)];
const [sx, sy] = P(-42);
const [ex, ey] = P(38);
const seams = [-98, -158, -218, -278].map((a) => [...P(a, R - W / 2 + 0.2), ...P(a, R + W / 2 - 0.2)]);

const BrandMark: FC<{ size?: number; className?: string }> = ({ size = 36, className = "" }) => (
  <svg className={`bs-mark ${className}`} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="BSFLY">
    <rect width="64" height="64" rx="14" fill="var(--bs-brand)" />
    <path d={`M${sx} ${sy}A${R} ${R} 0 1 0 ${ex} ${ey}`} fill="none" stroke="var(--bs-brand-ink)" strokeWidth={W} strokeLinecap="round" />
    {seams.map(([x1, y1, x2, y2], i) => (
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--bs-brand)" strokeWidth="1.6" strokeLinecap="round" />
    ))}
    <circle cx={sx + 0.9} cy={sy - 1.1} r="1.7" fill="var(--bs-brand)" />
  </svg>
);

export default BrandMark;
