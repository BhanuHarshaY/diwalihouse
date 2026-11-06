import { PALETTE as C } from '@/design-system/palette';

/** Three nested tongues of flame and a cool blue root. 100 × 180 grid, base at y = 170. */
export function FlameArt({ className }: { className?: string | undefined }) {
  return (
    <svg viewBox="0 0 100 180" className={className} aria-hidden focusable="false">
      <path
        d="M50 2C56 32 84 66 84 110C84 146 68 170 50 170C32 170 16 146 16 110C16 70 44 36 50 2Z"
        fill={C.marigold500}
      />
      <path
        d="M50 50C55 74 72 98 72 126C72 150 62 164 50 164C38 164 28 150 28 126C28 100 45 78 50 50Z"
        fill={C.marigold200}
      />
      <path
        d="M50 98C53 112 62 126 62 142C62 156 56 162 50 162C44 162 38 156 38 142C38 126 47 112 50 98Z"
        fill={C.ivory50}
      />
      <ellipse cx={50} cy={167} rx={9} ry={4.5} fill={C.peacock300} />
    </svg>
  );
}
