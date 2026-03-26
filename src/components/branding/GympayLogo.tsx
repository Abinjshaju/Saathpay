const heights = {
  sm: "h-6",
  md: "h-14",
  lg: "h-12",
} as const;

interface GympayLogoProps {
  className?: string;
  size?: keyof typeof heights;
  wordmark?: boolean;
}

export default function GympayLogo({ className = "", size = "md" }: GympayLogoProps) {
  return (
    <img
      src="/logo.png"
      alt="SaathPay"
      className={`${heights[size]} w-auto shrink-0 object-contain ${className}`}
    />
  );
}
