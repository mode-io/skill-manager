import { getHarnessPresentation } from "./harnessPresentation";

interface HarnessAvatarProps {
  harness: string;
  label: string;
  logoKey?: string | null;
  className?: string;
}

export function HarnessAvatar({
  harness,
  label,
  logoKey,
  className,
}: HarnessAvatarProps) {
  const presentation = getHarnessPresentation(logoKey ?? harness);
  const classes = ["harness-avatar", className].filter(Boolean).join(" ");

  if (!presentation) {
    return (
      <span className={classes} aria-hidden="true">
        <span className="harness-avatar__fallback">{label.slice(0, 1)}</span>
      </span>
    );
  }

  return (
    <span className={classes} aria-hidden="true">
      <img className="harness-avatar__logo" src={presentation.logoSrc} alt="" />
    </span>
  );
}
