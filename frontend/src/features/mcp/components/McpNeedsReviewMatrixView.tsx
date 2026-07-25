import { useMemo } from "react";

import {
  MatrixHarnessCellTarget,
  MatrixHarnessHeader,
  MatrixHarnessIcon,
  MatrixTable,
} from "../../../components/matrix";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { CardSelectCheckbox } from "../../../components/cards/CardSelectCheckbox";
import { UiTooltip } from "../../../components/ui/UiTooltip";
import { getHarnessPresentation } from "../../../components/harness/harnessPresentation";
import type { McpIdentityGroupDto, McpNeedsReviewHarnessDto } from "../api/management-types";
import { useMcpCopy } from "../i18n";

interface McpMatrixColumn {
  harness: string;
  label: string;
  logoKey?: string | null;
}

interface McpNeedsReviewMatrixViewProps {
  groups: McpIdentityGroupDto[];
  harnesses?: McpNeedsReviewHarnessDto[];
  pendingNames: ReadonlySet<string>;
  onOpenDetail: (name: string) => void;
  onAdoptIdentical: (name: string) => void;
  onChooseConfigToAdopt: (name: string) => void;
  selectedNames: ReadonlySet<string>;
  onToggleSelected: (name: string) => void;
}

export function McpNeedsReviewMatrixView({
  groups,
  harnesses = [],
  pendingNames,
  onOpenDetail,
  onAdoptIdentical,
  onChooseConfigToAdopt,
  selectedNames,
  onToggleSelected,
}: McpNeedsReviewMatrixViewProps) {
  const copy = useMcpCopy();

  const columns = useMemo<McpMatrixColumn[]>(() => {
    if (harnesses.length > 0) {
      return harnesses;
    }
    const map = new Map<string, McpMatrixColumn>();
    for (const group of groups) {
      for (const sighting of group.sightings ?? []) {
        if (!map.has(sighting.harness)) {
          map.set(sighting.harness, {
            harness: sighting.harness,
            label: sighting.label ?? sighting.harness,
            logoKey: sighting.logoKey ?? sighting.harness,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [groups, harnesses]);

  const isAdoptPending = (name: string) =>
    pendingNames.has(name) ||
    Array.from(pendingNames).some((key) => key.startsWith(`${name}:`));

  return (
    <MatrixTable
      ariaLabel={copy.detail.list.reviewAriaLabel || "MCP configs to review"}
      harnessColumnWidth="52px"
      compactColumnWidth="140px"
      coverageColumnWidth="160px"
    >
      <thead className="matrix-table__head">
        <tr>
          <th className="matrix-table__th matrix-table__th--checkbox" aria-label="Select" />
          <th className="matrix-table__th matrix-table__th--identity">{copy.detail.matrix.serverColumn}</th>
          {columns.map((column) => (
            <MatrixHarnessHeader
              key={column.harness}
              label={column.label}
              logoKey={column.logoKey}
              harness={column.harness}
            />
          ))}
          <th className="matrix-table__th matrix-table__th--compact" aria-label={copy.detail.matrix.harnessesColumn}>
            {copy.detail.matrix.harnessesColumn}
          </th>
          <th className="matrix-table__th matrix-table__th--end">Action</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((group) => {
          const pending = isAdoptPending(group.name);
          const isSelected = selectedNames.has(group.name);
          const selectable = group.identical;
          return (
            <tr key={group.name} className="matrix-table__row" data-checked={isSelected ? "true" : undefined}>
              <td className="matrix-table__cell matrix-table__cell--checkbox">
                <CardSelectCheckbox
                  checked={isSelected}
                  disabled={!selectable || pending}
                  label={isSelected ? `Deselect ${group.name}` : `Select ${group.name}`}
                  onToggle={() => onToggleSelected(group.name)}
                />
              </td>
              <td className="matrix-table__cell matrix-table__cell--identity">
                <button
                  type="button"
                  className="mcp-matrix__server-button"
                  aria-label={copy.detail.openDetail(group.name)}
                  onClick={() => onOpenDetail(group.name)}
                >
                  <span className="matrix-table__name-row">
                    <span className="matrix-table__name-text">{group.name}</span>
                  </span>
                  <span className="matrix-table__description">
                    {group.identical ? copy.detail.review.identical : copy.detail.review.differsAcrossHarnesses}
                  </span>
                </button>
              </td>
              {columns.map((column) => {
                const sighting = group.sightings.find((s) => s.harness === column.harness);
                const discovered = Boolean(sighting);
                const label = sighting?.label ?? column.label;
                const title = discovered
                  ? `Found in ${label} config`
                  : `Not found in ${label} config`;
                return (
                  <td key={column.harness} className="matrix-table__cell matrix-table__cell--harness">
                    <UiTooltip content={title}>
                      <MatrixHarnessCellTarget
                        state={discovered ? "observed" : "empty"}
                        ariaLabel={title}
                        title={title}
                        disabled
                      >
                        {discovered ? (
                          <MatrixHarnessIcon
                            label={label}
                            logoKey={sighting?.logoKey ?? column.logoKey}
                            harness={column.harness}
                          />
                        ) : (
                          "—"
                        )}
                      </MatrixHarnessCellTarget>
                    </UiTooltip>
                  </td>
                );
              })}
              <td className="matrix-table__cell matrix-table__cell--compact">
                <div className="harness-stack" aria-label={copy.detail.review.foundInHarnesses(group.sightings.length)}>
                  {group.sightings.map((s, index) => {
                    const presentation = getHarnessPresentation(s.logoKey ?? s.harness);
                    return (
                      <UiTooltip key={s.harness} content={s.label}>
                        <span
                          className="harness-stack__item"
                          style={{ zIndex: group.sightings.length - index }}
                        >
                          {presentation ? (
                            <img src={presentation.logoSrc} alt="" aria-hidden="true" />
                          ) : (
                            <span className="harness-stack__fallback">{s.label.slice(0, 1)}</span>
                          )}
                        </span>
                      </UiTooltip>
                    );
                  })}
                </div>
              </td>
              <td className="matrix-table__cell matrix-table__cell--coverage">
                <button
                  type="button"
                  className={`action-pill ${group.identical ? "action-pill--accent" : ""}`}
                  disabled={pending}
                  title={group.identical ? copy.detail.review.addTooltip : copy.detail.review.chooseTooltip}
                  onClick={() =>
                    group.identical ? onAdoptIdentical(group.name) : onChooseConfigToAdopt(group.name)
                  }
                >
                  {pending ? (
                    <LoadingSpinner size="sm" label={group.identical ? copy.detail.review.adopt : copy.detail.review.chooseConfigToAdopt} />
                  ) : null}
                  {group.identical ? copy.detail.review.adopt : copy.detail.review.chooseConfigToAdopt}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </MatrixTable>
  );
}
