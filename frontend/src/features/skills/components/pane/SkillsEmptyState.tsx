interface SkillsEmptyStateProps {
  onResetFilters: () => void;
}

export function SkillsEmptyState({ onResetFilters }: SkillsEmptyStateProps) {
  return (
    <div className="skills-empty-state">
      <div>
        <p className="skills-empty-state__eyebrow">No matching skills</p>
        <h3>No skills match the current filters.</h3>
        <p>Adjust the search or filter controls to bring skills back into view.</p>
      </div>
      <button type="button" className="btn btn-secondary" onClick={onResetFilters}>
        Clear Filters
      </button>
    </div>
  );
}
