import "../agents.css";
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";

import { useCreateAgentMutation } from "../api/queries";
import { useToast } from "../../../components/Toast";
import { ErrorBanner } from "../../../components/ErrorBanner";

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAgentDialog({
  open,
  onOpenChange,
}: CreateAgentDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [toolsStr, setToolsStr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const createMutation = useCreateAgentMutation();

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setPrompt("");
    setToolsStr("");
    setError(null);
  }, [open]);

  const canSubmit = name.trim().length > 0 && prompt.trim().length > 0;
  const isPending = createMutation.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        prompt: prompt.trim(),
        tools: toolsStr.split(",").map(s => s.trim()).filter(Boolean),
      });
      toast(`Successfully created agent ${name.trim()}`);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.error ?? "An error occurred while creating the agent.");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content agent-dialog-content">
          <div className="dialog-header">
            <Dialog.Title className="dialog-title">
              Create New Agent Persona
            </Dialog.Title>
            <Dialog.Close className="dialog-close-btn" disabled={isPending}>
              <X size={18} />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="dialog-form agent-dialog-form">
            <div className="dialog-form-fields agent-dialog-form-fields">
              {error && (
                <ErrorBanner message={error} onDismiss={() => setError(null)} />
              )}

              <label className="form-field">
                <span className="form-field__label">Agent Name *</span>
                <input
                  type="text"
                  className="form-field__input"
                  placeholder="e.g. Code Reviewer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isPending}
                  required
                />
              </label>

              <label className="form-field">
                <span className="form-field__label">Description</span>
                <textarea
                  className="form-field__textarea"
                  placeholder="Describe the agent's purpose and functionality..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isPending}
                  rows={2}
                />
              </label>

              <label className="form-field">
                <span className="form-field__label">Prompt *</span>
                <textarea
                  className="form-field__textarea"
                  placeholder="System instructions..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isPending}
                  rows={4}
                  required
                />
              </label>

              <label className="form-field">
                <span className="form-field__label">Tools (comma-separated)</span>
                <input
                  type="text"
                  className="form-field__input"
                  placeholder="e.g. file_search, bash"
                  value={toolsStr}
                  onChange={(e) => setToolsStr(e.target.value)}
                  disabled={isPending}
                />
              </label>
            </div>

            <div className="dialog-footer agent-dialog-footer">
              <Dialog.Close asChild>
                <button type="button" className="action-pill action-pill--md" disabled={isPending}>
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                className="action-pill action-pill--md action-pill--accent"
                disabled={!canSubmit || isPending}
              >
                {isPending ? <Loader2 className="animate-spin" size={16} /> : null}
                Create Agent
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
