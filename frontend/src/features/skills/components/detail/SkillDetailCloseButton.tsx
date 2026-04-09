import { X } from "lucide-react";

interface SkillDetailCloseButtonProps {
  onClick: () => void;
}

export function SkillDetailCloseButton({ onClick }: SkillDetailCloseButtonProps) {
  return (
    <button
      type="button"
      className="skill-detail__close-button"
      onClick={onClick}
      aria-label="Close skill details"
    >
      <X size={14} aria-hidden="true" />
    </button>
  );
}
