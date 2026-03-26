import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { disableSkill, enableSkill, fetchSkillsPage, manageAllSkills, manageSkill } from "../api/client";
import type { HarnessCell, HarnessCellState, SkillTableRow, SkillsPageData } from "../api/types";
import { ErrorBanner } from "../components/ErrorBanner";
import { SkillDetailDrawer } from "../components/SkillDetailDrawer";
import { SkillsWorkspaceTabs } from "../components/skills/SkillsWorkspaceTabs";
import type { SkillsWorkspaceContextValue } from "../components/skills/workspace";

interface SkillsWorkspacePageProps {
  refreshToken: number;
  onDataChanged: () => void;
}

export function SkillsWorkspacePage({
  refreshToken,
  onDataChanged,
}: SkillsWorkspacePageProps): JSX.Element {
  const location = useLocation();
  const [data, setData] = useState<SkillsPageData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedSkillRef, setSelectedSkillRef] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setErrorMessage("");
    void fetchSkillsPage()
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setData(payload);
        setStatus("ready");
      })
      .catch((error: Error) => {
        if (cancelled) {
          return;
        }
        setErrorMessage(error.message);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  useEffect(() => {
    setSelectedSkillRef(null);
  }, [location.pathname]);

  async function runAction(actionId: string, task: () => Promise<unknown>): Promise<void> {
    try {
      setBusyId(actionId);
      await task();
      onDataChanged();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to complete the action.");
    } finally {
      setBusyId(null);
    }
  }

  function handleToggleCell(row: SkillTableRow, cell: HarnessCell): void {
    const cellKey = `${row.skillRef}:${cell.harness}`;
    const newState: HarnessCellState = cell.state === "enabled" ? "disabled" : "enabled";

    setBusyId(cellKey);
    setData((current) => current ? applyCellToggle(current, row.skillRef, cell.harness, newState) : current);

    const apiCall = cell.state === "enabled"
      ? disableSkill(row.skillRef, cell.harness)
      : enableSkill(row.skillRef, cell.harness);

    void apiCall
      .catch((error) => {
        setData((current) => current ? applyCellToggle(current, row.skillRef, cell.harness, cell.state) : current);
        setErrorMessage(error instanceof Error ? error.message : "Unable to toggle the skill.");
      })
      .finally(() => setBusyId(null));
  }

  function handlePrimaryAction(row: SkillTableRow): void {
    if (row.primaryAction.kind === "manage") {
      void runAction(`manage:${row.skillRef}`, () => manageSkill(row.skillRef));
      return;
    }
    setSelectedSkillRef(row.skillRef);
  }

  const context: SkillsWorkspaceContextValue = {
    data,
    status,
    busyId,
    onManageAll: () => void runAction("manage-all", manageAllSkills),
    onOpenSkill: setSelectedSkillRef,
    onToggleCell: handleToggleCell,
    onRunPrimaryAction: handlePrimaryAction,
  };

  return (
    <>
      <section className="page-panel skills-workspace">
        <div className="skills-workspace__header">
          <div>
            <p className="page-header__eyebrow">Primary workspace</p>
            <h2>Skills</h2>
            <p className="page-header__copy">
              Operate managed skills separately from local intake, while keeping one shared inventory and one detail surface.
            </p>
          </div>
        </div>

        <SkillsWorkspaceTabs summary={data?.summary ?? null} />

        {errorMessage && <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage("")} />}

        <Outlet context={context} />
      </section>

      <SkillDetailDrawer
        skillRef={selectedSkillRef}
        refreshToken={refreshToken}
        onClose={() => setSelectedSkillRef(null)}
        onDataChanged={onDataChanged}
      />
    </>
  );
}

function applyCellToggle(
  data: SkillsPageData,
  skillRef: string,
  harness: string,
  newState: HarnessCellState,
): SkillsPageData {
  return {
    ...data,
    rows: data.rows.map((row) =>
      row.skillRef !== skillRef
        ? row
        : {
            ...row,
            cells: row.cells.map((cell) =>
              cell.harness !== harness ? cell : { ...cell, state: newState },
            ),
          },
    ),
  };
}
