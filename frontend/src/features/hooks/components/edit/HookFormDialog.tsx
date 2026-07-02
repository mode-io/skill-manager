import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";

const SUPPORTED_EVENTS = [
  "pre_tool_use",
  "post_tool_use",
  "user_prompt_submit",
  "session_start",
  "stop",
  "pre_compact",
];

interface HookFormValue {
  id: string;
  event: string;
  command: string;
  match: string | null;
  timeout: number | null;
  description: string;
}

interface HookFormDialogProps {
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: HookFormValue) => Promise<void> | void;
}

export function HookFormDialog({
  open,
  pending,
  onOpenChange,
  onSubmit,
}: HookFormDialogProps) {
  const [id, setId] = useState("");
  const [event, setEvent] = useState("pre_tool_use");
  const [command, setCommand] = useState("");
  const [match, setMatch] = useState("any");
  const [timeoutStr, setTimeoutStr] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setId("");
    setEvent("pre_tool_use");
    setCommand("");
    setMatch("any");
    setTimeoutStr("");
    setDescription("");
  }, [open]);

  const canSubmit = id.trim() && event.trim() && command.trim();
  const showMatchSelector = event === "pre_tool_use" || event === "post_tool_use";

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!canSubmit) return;
    const timeoutVal = timeoutStr.trim() ? parseInt(timeoutStr, 10) : null;
    await onSubmit({
      id: id.trim(),
      event,
      command: command.trim(),
      match: showMatchSelector ? match : null,
      timeout: isNaN(Number(timeoutVal)) ? null : timeoutVal,
      description: description.trim(),
    });
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={onOpenChange}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" aria-describedby="hook-form-dialog-desc">
          <div className="dialog-header">
            <Dialog.Title className="dialog-title">
              Add Hook
            </Dialog.Title>
            <Dialog.Close className="dialog-close-btn" disabled={pending}>
              <X size={18} />
            </Dialog.Close>
          </div>

          <div id="hook-form-dialog-desc" style={{ display: "none" }}>
            Add a new hook configuration that will run a command on the specified lifecycle event.
          </div>

          <form onSubmit={handleSubmit} className="dialog-form">
            <div className="dialog-form-fields">
              <label className="form-field">
                <span className="form-field__label">Hook ID *</span>
                <input
                  type="text"
                  className="form-field__input"
                  placeholder="e.g. format-json-hook"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  disabled={pending}
                  required
                />
              </label>

              <label className="form-field">
                <span className="form-field__label">Event *</span>
                <select
                  className="form-field__select"
                  value={event}
                  onChange={(e) => setEvent(e.target.value)}
                  disabled={pending}
                  required
                >
                  {SUPPORTED_EVENTS.map((evt) => (
                    <option key={evt} value={evt}>
                      {evt}
                    </option>
                  ))}
                </select>
              </label>

              {showMatchSelector ? (
                <label className="form-field">
                  <span className="form-field__label">Tool Category</span>
                  <select
                    className="form-field__select"
                    value={match}
                    onChange={(e) => setMatch(e.target.value)}
                    disabled={pending}
                  >
                    <option value="any">any</option>
                    <option value="shell">shell</option>
                    <option value="file_read">file_read</option>
                    <option value="file_write">file_write</option>
                    <option value="mcp">mcp</option>
                    <option value="web">web</option>
                  </select>
                </label>
              ) : null}

              <label className="form-field">
                <span className="form-field__label">Command *</span>
                <input
                  type="text"
                  className="form-field__input"
                  placeholder="e.g. /path/to/formatter.sh"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  disabled={pending}
                  required
                />
              </label>

              <label className="form-field">
                <span className="form-field__label">Timeout (seconds, optional)</span>
                <input
                  type="number"
                  className="form-field__input"
                  placeholder="e.g. 60"
                  value={timeoutStr}
                  onChange={(e) => setTimeoutStr(e.target.value)}
                  disabled={pending}
                />
              </label>

              <label className="form-field">
                <span className="form-field__label">Description</span>
                <textarea
                  className="form-field__textarea"
                  placeholder="Describe what this hook does..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={pending}
                  rows={3}
                />
              </label>
            </div>

            <div className="dialog-footer">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="action-pill action-pill--md"
                  disabled={pending}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="action-pill action-pill--md action-pill--accent"
                disabled={!canSubmit || pending}
              >
                {pending ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Adding...
                  </>
                ) : (
                  "Add Hook"
                )}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
