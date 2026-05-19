import type { SkillsCopy } from "../../i18n";

interface SkillsEmptyStateProps {
  copy: SkillsCopy["filters"];
  onResetFilters: () => void;
}

export function SkillsEmptyState({ copy, onResetFilters }: SkillsEmptyStateProps) {
  return (
    <div className="skills-empty-state">
      <div>
        <h3>{copy.noMatchTitle}</h3>
        <p>{copy.noMatchBody}</p>
      </div>
      <button
        type="button"
        className="action-pill action-pill--md"
        onClick={onResetFilters}
      >
        {copy.clearFilters}
      </button>
    </div>
  );
}
