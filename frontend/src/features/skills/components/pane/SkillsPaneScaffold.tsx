import type { ReactNode, RefObject } from "react";

import { LoadingSpinner } from "../../../../components/LoadingSpinner";
import { SkillsPaneChrome } from "./SkillsPaneChrome";

interface SkillsPaneScaffoldProps {
  title: string;
  actions?: ReactNode;
  searchValue: string;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onReset: () => void;
  searchLabel: string;
  searchInputLabel: string;
  searchPlaceholder: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  isReady: boolean;
  isInitialLoading: boolean;
  hasError: boolean;
  loadingLabel: string;
  errorMessage: string;
  children: ReactNode;
}

export function SkillsPaneScaffold({
  title,
  actions,
  searchValue,
  hasActiveFilters,
  onSearchChange,
  onReset,
  searchLabel,
  searchInputLabel,
  searchPlaceholder,
  scrollRef,
  isReady,
  isInitialLoading,
  hasError,
  loadingLabel,
  errorMessage,
  children,
}: SkillsPaneScaffoldProps) {
  return (
    <section className="skills-pane">
      {isReady ? (
        <>
          <SkillsPaneChrome
            title={title}
            actions={actions}
            searchValue={searchValue}
            hasActiveFilters={hasActiveFilters}
            onSearchChange={onSearchChange}
            onReset={onReset}
            searchLabel={searchLabel}
            searchInputLabel={searchInputLabel}
            searchPlaceholder={searchPlaceholder}
          />

          <div className="skills-pane__scroll ui-scrollbar" ref={scrollRef}>
            <div className="skills-pane__content">{children}</div>
          </div>
        </>
      ) : null}

      {isInitialLoading ? (
        <div className="panel-state skills-pane__state">
          <LoadingSpinner label={loadingLabel} />
        </div>
      ) : null}

      {hasError ? (
        <div className="panel-state skills-pane__state">
          <p>{errorMessage}</p>
        </div>
      ) : null}
    </section>
  );
}
