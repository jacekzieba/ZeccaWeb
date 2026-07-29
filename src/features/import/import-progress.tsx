import { V2, V2_TYPE, v2Mix } from "@/lib/v2-design";

export type ImportProgressState = {
  label: string;
  value: number;
};

export function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export function ImportProgressIndicator({
  label,
  value,
}: ImportProgressState) {
  const progress = Math.min(100, Math.max(0, Math.round(value)));

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 7,
        padding: "11px 12px",
        borderRadius: 10,
        background: v2Mix(V2.brand, 0.06),
        color: V2.ink,
        fontFamily: V2_TYPE.ui,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5 }}>
        <span>{label}</span>
        <span style={{ color: V2.brand, fontFamily: V2_TYPE.mono, fontWeight: 700 }}>
          {progress}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Postęp importu pliku"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-valuetext={label}
        style={{
          height: 6,
          overflow: "hidden",
          borderRadius: 999,
          background: v2Mix(V2.brand, 0.14),
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            borderRadius: "inherit",
            background: V2.brand,
            transition: "width 180ms ease-out",
          }}
        />
      </div>
    </div>
  );
}
