import { getHarnessPresentation } from "./harnessPresentation";

interface HarnessMarkProps {
  harness: string;
  label: string;
  logoKey?: string | null;
  className?: string;
}

export function HarnessMark({ harness, label, logoKey, className }: HarnessMarkProps) {
  const presentation = getHarnessPresentation(logoKey ?? harness);
  const classes = ["skill-harness-mark", className].filter(Boolean).join(" ");

  if (!presentation) {
    return <span className={`${classes} skill-harness-mark--text`}>{label}</span>;
  }

  return (
    <span className={`${classes} skill-harness-mark--logo skill-harness-mark--${presentation.variant}`}>
      <img className="skill-harness-mark__logo" src={presentation.logoSrc} alt="" aria-hidden="true" />
      <span className="u-visually-hidden">{label}</span>
    </span>
  );
}
