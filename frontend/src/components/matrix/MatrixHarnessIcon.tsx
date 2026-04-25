import { getHarnessPresentation } from "../harness/harnessPresentation";

interface MatrixHarnessIconProps {
  label: string;
  logoKey?: string | null;
  harness?: string;
}

export function MatrixHarnessIcon({ label, logoKey, harness }: MatrixHarnessIconProps) {
  const presentation = getHarnessPresentation(logoKey ?? harness ?? label);

  if (presentation) {
    return (
      <img
        className="matrix-harness-target__logo"
        src={presentation.logoSrc}
        alt=""
        aria-hidden="true"
      />
    );
  }

  return <span className="matrix-harness-target__fallback">{label.slice(0, 1)}</span>;
}
