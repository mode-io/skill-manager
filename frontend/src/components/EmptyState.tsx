import type { ElementType } from "react";

interface EmptyStateProps {
  icon: ElementType;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps): JSX.Element {
  return (
    <div className="empty-state">
      <Icon />
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button className="btn btn-primary" onClick={action.onClick}>{action.label}</button>
      )}
    </div>
  );
}
