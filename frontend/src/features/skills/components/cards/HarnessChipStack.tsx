import { UiTooltip } from "../../../../components/ui/UiTooltip";
import { getHarnessPresentation } from "../../../../components/harness/harnessPresentation";
import type { HarnessCell } from "../../model/types";

interface HarnessChipStackProps {
  cells: HarnessCell[];
  label?: string;
}

/**
 * Renders the chip stack + X/N count for a skill row.
 *
 * Count denominator = number of *addressable* cells (cell.interactive ===
 * true). The backend already sets `interactive` to be both
 * state-toggleable AND column.installed, so we never need to cross-
 * reference columns here. Chip stack renders enabled-and-addressable
 * cells only, keeping the logos consistent with the denominator.
 */
export function HarnessChipStack({ cells, label }: HarnessChipStackProps) {
  const addressable = cells.filter((cell) => cell.interactive);
  const enabledCells = addressable.filter((cell) => cell.state === "enabled");
  const enabledCount = enabledCells.length;
  const totalCount = addressable.length;
  const ariaLabel = label ?? `Enabled on ${enabledCount} harness${enabledCount === 1 ? "" : "es"}`;

  return (
    <div className="skill-card__harness-row">
      <div className="harness-stack" aria-label={ariaLabel}>
        {enabledCells.map((cell, index) => {
          const presentation = getHarnessPresentation(cell.logoKey ?? cell.harness);
          return (
            <UiTooltip key={cell.harness} content={cell.label}>
              <span
                className="harness-stack__item"
                style={{ zIndex: enabledCount - index }}
              >
                {presentation ? (
                  <img src={presentation.logoSrc} alt="" aria-hidden="true" />
                ) : (
                  <span className="harness-stack__fallback">{cell.label.slice(0, 1)}</span>
                )}
              </span>
            </UiTooltip>
          );
        })}
      </div>
      <span className="skill-card__harness-count">
        {enabledCount}/{totalCount}
      </span>
    </div>
  );
}
