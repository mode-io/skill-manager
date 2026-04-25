import type { ReactNode } from "react";

interface DetailNoteProps {
  children: ReactNode;
  className?: string;
}

export function DetailNote({ children, className }: DetailNoteProps) {
  const classes = ["detail-note", className].filter(Boolean).join(" ");
  return <div className={classes}>{children}</div>;
}
