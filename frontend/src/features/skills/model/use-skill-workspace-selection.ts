import { useCallback, useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

import { skillStatusConcept } from "../../../lib/product-language";
import type { SkillListRow, SkillsWorkspaceData } from "./types";

export type SkillsWorkspaceTab = "inUse" | "needsReview";

export function useSkillWorkspaceSelection(data: SkillsWorkspaceData | null) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobileDetail = useCompactDetailLayout();
  const activeTab: SkillsWorkspaceTab = location.pathname.endsWith("/review") || location.pathname.endsWith("/unmanaged")
    ? "needsReview"
    : "inUse";
  const selectedSkillRef = searchParams.get("skill");

  const updateSelectedSkillRef = useCallback((skillRef: string | null, replace = false) => {
    const nextParams = new URLSearchParams(searchParams);
    if (skillRef) {
      nextParams.set("skill", skillRef);
    } else {
      nextParams.delete("skill");
    }
    setSearchParams(nextParams, { replace });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!selectedSkillRef || !data) {
      return;
    }
    const stillVisibleInTab = data.rows.some((row) =>
      row.skillRef === selectedSkillRef && rowVisibleOnTab(row, activeTab),
    );
    if (!stillVisibleInTab) {
      updateSelectedSkillRef(null, true);
    }
  }, [activeTab, data, selectedSkillRef, updateSelectedSkillRef]);

  const handleOpenSkill = useCallback((skillRef: string) => {
    updateSelectedSkillRef(selectedSkillRef === skillRef ? null : skillRef);
  }, [selectedSkillRef, updateSelectedSkillRef]);

  return {
    activeTab,
    selectedSkillRef,
    isDesktopDetailOpen: Boolean(selectedSkillRef) && !isMobileDetail,
    closeSelectedSkill: () => updateSelectedSkillRef(null),
    handleOpenSkill,
    updateSelectedSkillRef,
  };
}

function rowVisibleOnTab(row: SkillListRow, tab: SkillsWorkspaceTab): boolean {
  if (tab === "needsReview") {
    return skillStatusConcept(row.displayStatus) === "needsReview";
  }
  return skillStatusConcept(row.displayStatus) === "inUse";
}

function useCompactDetailLayout(breakpointPx = 900): boolean {
  const [matches, setMatches] = useState(() => getCompactDetailLayoutMatch(breakpointPx));

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      setMatches(getCompactDetailLayoutMatch(breakpointPx));
      return undefined;
    }

    const mediaQuery = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const update = () => setMatches(mediaQuery.matches);
    update();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }

    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, [breakpointPx]);

  return matches;
}

function getCompactDetailLayoutMatch(breakpointPx: number): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (typeof window.matchMedia === "function") {
    return window.matchMedia(`(max-width: ${breakpointPx}px)`).matches;
  }
  return window.innerWidth <= breakpointPx;
}
