import { LoadingSpinner } from "./LoadingSpinner";

interface RouteLoadingPanelProps {
  label: string;
}

export default function RouteLoadingPanel({ label }: RouteLoadingPanelProps) {
  return (
    <section className="page-panel panel-state">
      <LoadingSpinner label={label} />
    </section>
  );
}
