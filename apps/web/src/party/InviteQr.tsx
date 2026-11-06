'use client';

import QRCode from 'qrcode';
import { useMemo } from 'react';

/**
 * QR code drawn as one SVG path in the house ink. Error correction level M
 * keeps it scannable from a phone held at arm's length to a TV.
 */
export function InviteQr({ url, className }: { url: string; className?: string | undefined }) {
  const { size, d } = useMemo(() => {
    const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    let path = '';
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (qr.modules.get(row, col)) path += `M${col} ${row}h1v1h-1z`;
      }
    }
    return { size: n, d: path };
  }, [url]);

  const margin = 2;
  return (
    <svg
      viewBox={`${-margin} ${-margin} ${size + margin * 2} ${size + margin * 2}`}
      className={className}
      role="img"
      aria-label="QR code for the invitation link"
      shapeRendering="crispEdges"
    >
      <rect
        x={-margin}
        y={-margin}
        width={size + margin * 2}
        height={size + margin * 2}
        fill="#fbf5e6"
      />
      <path d={d} fill="#12163d" />
    </svg>
  );
}
