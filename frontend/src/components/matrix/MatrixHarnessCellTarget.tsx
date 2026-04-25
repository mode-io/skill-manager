import type { MouseEventHandler, ReactNode } from "react";

type MatrixHarnessCellTargetProps = {
  children: ReactNode;
  ariaLabel: string;
  state?: string;
  pending?: boolean;
  disabled?: boolean;
  ariaPressed?: boolean;
  title?: string;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

export function MatrixHarnessCellTarget({
  children,
  ariaLabel,
  state,
  pending = false,
  disabled = false,
  ariaPressed,
  title,
  className,
  onClick,
}: MatrixHarnessCellTargetProps) {
  const classNames = ["matrix-harness-target"];
  if (onClick) classNames.push("matrix-harness-target--interactive");
  if (className) classNames.push(className);

  if (!onClick) {
    return (
      <span
        className={classNames.join(" ")}
        data-state={state}
        data-pending={pending ? "true" : undefined}
        aria-label={ariaLabel}
        aria-disabled={disabled ? "true" : undefined}
        title={title}
      >
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={classNames.join(" ")}
      data-state={state}
      data-pending={pending ? "true" : undefined}
      disabled={disabled || pending}
      aria-label={ariaLabel}
      aria-disabled={disabled || pending ? "true" : undefined}
      aria-pressed={ariaPressed}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
