import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface SkillDetailDisclosureProps {
  title: string;
  eyebrow?: string;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

export function SkillDetailDisclosure({
  title,
  eyebrow,
  defaultOpen = false,
  className = "",
  children,
}: SkillDetailDisclosureProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section className={`skill-detail-disclosure${isOpen ? " is-open" : ""}${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className="skill-detail-disclosure__trigger"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="skill-detail-disclosure__heading">
          {eyebrow ? <span className="skill-detail-disclosure__eyebrow">{eyebrow}</span> : null}
          <span className="skill-detail-disclosure__title">{title}</span>
        </span>
        <ChevronDown className="skill-detail-disclosure__chevron" size={16} aria-hidden="true" />
      </button>
      <div className="skill-detail-disclosure__frame" id={panelId}>
        <div className="skill-detail-disclosure__body">{children}</div>
      </div>
    </section>
  );
}
