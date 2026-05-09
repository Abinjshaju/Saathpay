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

export default function GympayLogo({ className = "", size = "md", wordmark = false }: GympayLogoProps) {
  const src = wordmark ? "/logo/logo3.svg" : "/logo/logo2.svg";
  return (
    <img
      src={src}
      alt="SaathPay"
      className={`${heights[size]} w-auto shrink-0 object-contain ${className}`}
    />
  );
}
