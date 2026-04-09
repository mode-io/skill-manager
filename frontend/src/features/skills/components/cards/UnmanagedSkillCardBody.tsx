interface UnmanagedSkillCardBodyProps {
  description: string;
}

export function UnmanagedSkillCardBody({
  description,
}: UnmanagedSkillCardBodyProps) {
  return (
    <div className="skill-card__body skill-card__body--unmanaged">
      <p className="skill-card__description">{description || "No description provided."}</p>
    </div>
  );
}
