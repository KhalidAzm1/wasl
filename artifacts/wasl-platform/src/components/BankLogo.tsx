import { useState } from "react";
import { Building2 } from "lucide-react";

interface BankLogoProps {
  src?: string | null;
  alt: string;
  fallbackText?: string;
  className?: string;
}

/** Renders a bank logo image, gracefully falling back to an icon/initials if the image fails to load (e.g. unreachable external logo host). */
export function BankLogo({ src, alt, fallbackText, className }: BankLogoProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return fallbackText ? (
      <span className="text-2xl font-bold text-white/20">{fallbackText}</span>
    ) : (
      <Building2 className="w-1/2 h-1/2 text-white/30" />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className ?? "w-full h-full object-contain"}
      onError={() => setFailed(true)}
    />
  );
}
