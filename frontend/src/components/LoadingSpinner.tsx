interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
}

export function LoadingSpinner({ size = "md", label = "Loading" }: LoadingSpinnerProps) {
  return <span className={`spinner spinner-${size}`} role="status" aria-label={label} />;
}
