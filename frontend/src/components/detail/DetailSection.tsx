import type { ReactNode } from "react";

interface DetailSectionProps {
  heading: string;
  children: ReactNode;
  className?: string;
}

/**
 * Body section for any detail-sheet modal (skill, MCP server, marketplace).
 * Imposes a consistent heading + spacing rhythm so the four-or-five-section
 * body of every detail view reads the same way.
 *
 * Layout-only: doesn't dictate which sections appear, only that whichever
 * does appear gets the same heading and gap.
 */
export function DetailSection({
  heading,
  children,
  className,
}: DetailSectionProps) {
  const sectionClass = className
    ? `detail-sheet__section ${className}`
    : "detail-sheet__section";

  return (
    <section className={sectionClass}>
      <h3 className="detail-sheet__section-heading">{heading}</h3>
      {children}
    </section>
  );
}
