// src/components/auth/2fa/QRDisplay.tsx
import Image from "next/image";

export function QRDisplay({
  qrCode,
  onQrError,
}: {
  qrCode: string;
  onQrError?: () => void;
}) {
  return (
    <div className="border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex justify-center">
        <Image
          src={qrCode.trimEnd()}
          alt="2FA QR Code"
          width={192}
          height={192}
          unoptimized
          className="h-48 w-48 bg-white p-3"
          loading="lazy"
          onError={() => onQrError?.()}
        />
      </div>

      <p className="mt-4 text-center text-xs text-zinc-500">
        Scan with Google Authenticator or any TOTP app
      </p>
    </div>
  );
}
