/** Znak pustego stanu: rondel — krążek przed wybiciem.
 *
 * Mennica nie zdobiła, tylko ważyła i sprawdzała próbę. Pusty widok to krążek,
 * który czeka na stempel — nie ikona braku. Zastępuje glify ◎ / ◈ / ↕ stawiane
 * wcześniej na 12% krycia.
 * Specyfikacja: docs/superpowers/specs/2026-09-07-design-system-skarbiec-design.md */
export function EmptyMark({ size = 96 }: { size?: number }) {
  return (
    <img
      src="/app/rondel.webp"
      alt=""
      aria-hidden
      width={size}
      height={size}
      style={{
        display: "block",
        width: size,
        height: size,
        marginBottom: 14,
        opacity: 0.85,
        // Wtapiamy krawędzie kadru w podłoże — zdjęcie ma być znakiem, nie kafelkiem.
        maskImage: "radial-gradient(circle at 50% 50%, #000 52%, transparent 74%)",
        WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 52%, transparent 74%)",
      }}
    />
  );
}
