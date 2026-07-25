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
import type { SlashCommandReviewDto, SlashReviewAction, SlashTargetDto } from "../api/types";
import { useSlashCommandsCopy } from "../i18n";
import { primaryReviewAction } from "../model/selectors";
import { reviewKey } from "../model/useSlashCommandsReviewController";

interface SlashCommandReviewMatrixViewProps {
  rows: SlashCommandReviewDto[];
  targets: SlashTargetDto[];
  pendingKey: string | null;
  onAction: (row: SlashCommandReviewDto, action?: SlashReviewAction | null) => Promise<boolean>;
  onOpen: (row: SlashCommandReviewDto) => void;
  selectedRefs: ReadonlySet<string>;
  onToggleSelected: (ref: string) => void;
}

export function SlashCommandReviewMatrixView({
  rows,
  targets,
  pendingKey,
  onAction,
  onOpen,
  selectedRefs,
  onToggleSelected,
}: SlashCommandReviewMatrixViewProps) {
  const copy = useSlashCommandsCopy();

  // Columns come from the payload's target list and nothing else: it is already
  // ordered canonically and already excludes harnesses disabled in Settings.
  // Synthesizing columns from the rows instead would resurrect both problems —
  // row order is not harness order, and a row can only exist for a target the
  // payload also lists.
  const displayTargets = targets;

  return (
    <MatrixTable
      ariaLabel={copy.review.listAria || "Slash commands to review list"}
      harnessColumnWidth="52px"
      compactColumnWidth="140px"
      coverageColumnWidth="140px"
    >
      <thead className="matrix-table__head">
        <tr>
          <th className="matrix-table__th matrix-table__th--checkbox" aria-label="Select" />
          <th className="matrix-table__th matrix-table__th--identity">Command</th>
          {displayTargets.map((target) => (
            <MatrixHarnessHeader
              key={target.id}
              label={target.label}
              logoKey={target.id === "claude" ? "claude" : target.id}
              harness={target.id}
            />
          ))}
          <th className="matrix-table__th matrix-table__th--compact" aria-label="Harnesses">
            Harnesses
          </th>
          <th className="matrix-table__th matrix-table__th--end">Action</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const primaryAction = primaryReviewAction(row);
          const isSelected = selectedRefs.has(row.reviewRef);
          const isPending = primaryAction
            ? pendingKey === reviewKey(row.target, row.name, primaryAction)
            : false;
          const actionLabel = copy.review.actionLabel(primaryAction);
          const actionTitle = primaryAction
            ? copy.review.actionTitle(primaryAction)
            : row.error ?? copy.review.cannotUpdate;

          return (
            <tr key={row.reviewRef} className="matrix-table__row" data-checked={isSelected ? "true" : undefined}>
              <td className="matrix-table__cell matrix-table__cell--checkbox">
                <CardSelectCheckbox
                  checked={isSelected}
                  disabled={!primaryAction || isPending}
                  label={isSelected ? `Deselect ${row.name}` : `Select ${row.name}`}
                  onToggle={() => onToggleSelected(row.reviewRef)}
                />
              </td>
              <td className="matrix-table__cell matrix-table__cell--identity">
                <button
                  type="button"
                  className="mcp-matrix__server-button"
                  aria-label={`Open detail for ${row.name}`}
                  onClick={() => onOpen(row)}
                >
                  <span className="matrix-table__name-row">
                    <span className="matrix-table__name-text">{row.name}</span>
                  </span>
                  <span className="matrix-table__description">
                    {copy.review.metaText(row)}
                  </span>
                </button>
              </td>
              {displayTargets.map((target) => {
                const isTarget = row.target === target.id;
                const title = isTarget
                  ? copy.review.metaText(row)
                  : `Not found in ${target.label}`;

                return (
                  <td key={target.id} className="matrix-table__cell matrix-table__cell--harness">
                    <UiTooltip content={title}>
                      <MatrixHarnessCellTarget
                        state={isTarget ? "observed" : "empty"}
                        ariaLabel={title}
                        title={title}
                        disabled
                      >
                        {isTarget ? (
                          <MatrixHarnessIcon
                            label={target.label}
                            logoKey={target.id === "claude" ? "claude" : target.id}
                            harness={target.id}
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
                <div className="harness-stack" aria-label={copy.review.metaText(row)}>
                  <UiTooltip content={row.targetLabel}>
                    <span className="harness-stack__item">
                      {getHarnessPresentation(row.target === "claude" ? "claude" : row.target) ? (
                        <img
                          src={getHarnessPresentation(row.target === "claude" ? "claude" : row.target)!.logoSrc}
                          alt=""
                          aria-hidden="true"
                        />
                      ) : (
                        <span className="harness-stack__fallback">{row.targetLabel.slice(0, 1)}</span>
                      )}
                    </span>
                  </UiTooltip>
                </div>
              </td>
              <td className="matrix-table__cell matrix-table__cell--coverage">
                <button
                  type="button"
                  className="action-pill action-pill--accent"
                  disabled={!primaryAction || isPending}
                  title={actionTitle}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (primaryAction) void onAction(row, primaryAction);
                  }}
                >
                  {isPending ? (
                    <LoadingSpinner size="sm" label={actionLabel} />
                  ) : null}
                  {actionLabel}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </MatrixTable>
  );
}
