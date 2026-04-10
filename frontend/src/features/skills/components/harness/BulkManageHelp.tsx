import { HelpPopover } from "../../../../components/ui/HelpPopover";

const BULK_MANAGE_COPY =
  "Moves local copies into the Shared Store, then replaces tool-folder copies with managed links.";

export function BulkManageHelp() {
  return (
    <HelpPopover title="Bulk Manage" copy={BULK_MANAGE_COPY} align="end">
        <button
          type="button"
          className="btn btn-secondary skills-pane__help-trigger"
          aria-label="What happens when you manage all eligible skills"
        >
          What Happens?
        </button>
    </HelpPopover>
  );
}
