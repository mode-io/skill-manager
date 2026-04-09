import { LoadingSpinner } from "../LoadingSpinner";

interface DetailLoadingChipProps {
  label: string;
  withSpinner?: boolean;
}

export function DetailLoadingChip({ label, withSpinner = false }: DetailLoadingChipProps) {
  return (
    <span className="detail-loading-chip">
      {withSpinner ? <LoadingSpinner size="sm" label={label} /> : null}
      <span>{label}</span>
    </span>
  );
}
