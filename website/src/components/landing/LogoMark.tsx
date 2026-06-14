import Image from "next/image";

type LogoMarkProps = {
  size?: number;
  className?: string;
};

export function LogoMark({ size = 36, className }: LogoMarkProps) {
  return (
    <Image
      src="/images/betterwallet-logo.png"
      alt="Better Wallet logo"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}
