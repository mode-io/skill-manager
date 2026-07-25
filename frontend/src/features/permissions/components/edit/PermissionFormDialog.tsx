import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

const SUPPORTED_DECISIONS = ["allow", "deny", "ask"];
const SUPPORTED_SCOPES = ["shell", "file_read", "file_write", "web", "mcp", "any"];

interface PermissionFormValue {
  id: string;
  decision: string;
  scope: string;
  pattern: string | null;
  description: string;
}

interface PermissionFormDialogProps {
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: PermissionFormValue) => Promise<void> | void;
}

export function PermissionFormDialog({
  open,
  pending,
  onOpenChange,
  onSubmit,
}: PermissionFormDialogProps) {
  const [id, setId] = useState("");
  const [decision, setDecision] = useState("allow");
  const [scope, setScope] = useState("shell");
  const [pattern, setPattern] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setId("");
    setDecision("allow");
    setScope("shell");
    setPattern("");
    setDescription("");
  }, [open]);

  const canSubmit = id.trim() && decision.trim() && scope.trim();

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!canSubmit) return;
    await onSubmit({
      id: id.trim(),
      decision,
      scope,
      pattern: pattern.trim() ? pattern.trim() : null,
      description: description.trim(),
    });
  }

  function getHarnessSupport(harness: string, decisionVal: string, scopeVal: string) {
    if (harness === "claude") {
      if (scopeVal === "any") {
        return { status: "unsupported", text: "Unsupported" };
      }
      return { status: "supported", text: "Supported" };
    }
    if (harness === "agy") {
      if (scopeVal === "shell" || scopeVal === "mcp") {
        return { status: "supported", text: "Supported" };
      }
      return { status: "unsupported", text: "Unsupported" };
    }
    if (harness === "codex") {
      if (decisionVal === "ask") {
        return { status: "unsupported", text: "Unsupported (no ask policy)" };
      }
      if (scopeVal === "file_read" || scopeVal === "file_write" || scopeVal === "web") {
        return { status: "supported", text: "Supported" };
      }
      if (scopeVal === "shell") {
        return { status: "caveat", text: "Caveat: sandbox/approval govern shell" };
      }
      if (scopeVal === "mcp") {
        return { status: "caveat", text: "Caveat: config.toml has no MCP allowlist" };
      }
      return { status: "unsupported", text: "Unsupported" };
    }
    return { status: "unsupported", text: "Unsupported" };
  }

  const claudeSupport = getHarnessSupport("claude", decision, scope);
  const agySupport = getHarnessSupport("agy", decision, scope);
  const codexSupport = getHarnessSupport("codex", decision, scope);

  const getPatternPlaceholder = () => {
    switch (scope) {
      case "shell":
        return "e.g. git push";
      case "file_read":
      case "file_write":
        return "e.g. ~/.zshrc or ./.env";
      case "web":
        return "e.g. api.example.com";
      case "mcp":
        return "e.g. gcloud/deploy or sqlite";
      default:
        return "Opaque specifier...";
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={onOpenChange}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" aria-describedby="permission-form-dialog-desc">
          <div className="dialog-header">
            <Dialog.Title className="dialog-title">
              Add Permission
            </Dialog.Title>
            <Dialog.Close className="dialog-close-btn" disabled={pending}>
              <X size={18} />
            </Dialog.Close>
          </div>

          <div id="permission-form-dialog-desc" style={{ display: "none" }}>
            Add a new permission configuration to allow, deny, or ask for agent operations.
          </div>

          <form onSubmit={handleSubmit} className="dialog-form">
            <div className="dialog-form-fields">
              <label className="form-field">
                <span className="form-field__label">Permission ID *</span>
                <input
                  type="text"
                  className="form-field__input"
                  placeholder="e.g. allow-git-push"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  disabled={pending}
                  required
                />
              </label>

              <div className="grid grid-cols-2 gap-4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <label className="form-field">
                  <span className="form-field__label">Decision *</span>
                  <select
                    className="form-field__select"
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                    disabled={pending}
                    required
                  >
                    {SUPPORTED_DECISIONS.map((dec) => (
                      <option key={dec} value={dec}>
                        {dec}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span className="form-field__label">Scope *</span>
                  <select
                    className="form-field__select"
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    disabled={pending}
                    required
                  >
                    {SUPPORTED_SCOPES.map((sc) => (
                      <option key={sc} value={sc}>
                        {sc}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {scope !== "any" ? (
                <label className="form-field">
                  <span className="form-field__label">Pattern *</span>
                  <input
                    type="text"
                    className="form-field__input"
                    placeholder={getPatternPlaceholder()}
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    disabled={pending}
                    required
                  />
                </label>
              ) : null}

              <label className="form-field">
                <span className="form-field__label">Description</span>
                <textarea
                  className="form-field__textarea"
                  placeholder="Describe what this permission governs..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={pending}
                  rows={3}
                />
              </label>

              {/* Harness support matrix visualization */}
              <div className="form-field" style={{ marginTop: "1rem" }}>
                <span className="form-field__label" style={{ marginBottom: "0.5rem" }}>Harness Support Outlook</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.75rem", background: "rgba(0, 0, 0, 0.03)", borderRadius: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "between", width: "100%" }}>
                    <span style={{ fontWeight: 500, fontSize: "0.85rem", width: "120px" }}>Claude Code:</span>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem" }}>
                      {claudeSupport.status === "supported" ? (
                        <><CheckCircle2 size={14} color="#10b981" /> <span style={{ color: "#10b981" }}>{claudeSupport.text}</span></>
                      ) : (
                        <><XCircle size={14} color="#ef4444" /> <span style={{ color: "#ef4444" }}>{claudeSupport.text}</span></>
                      )}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "between", width: "100%" }}>
                    <span style={{ fontWeight: 500, fontSize: "0.85rem", width: "120px" }}>Antigravity:</span>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem" }}>
                      {agySupport.status === "supported" ? (
                        <><CheckCircle2 size={14} color="#10b981" /> <span style={{ color: "#10b981" }}>{agySupport.text}</span></>
                      ) : (
                        <><XCircle size={14} color="#ef4444" /> <span style={{ color: "#ef4444" }}>{agySupport.text}</span></>
                      )}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "between", width: "100%" }}>
                    <span style={{ fontWeight: 500, fontSize: "0.85rem", width: "120px" }}>Codex:</span>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8rem" }}>
                      {codexSupport.status === "supported" && (
                        <><CheckCircle2 size={14} color="#10b981" /> <span style={{ color: "#10b981" }}>{codexSupport.text}</span></>
                      )}
                      {codexSupport.status === "caveat" && (
                        <><AlertTriangle size={14} color="#f59e0b" /> <span style={{ color: "#f59e0b" }}>{codexSupport.text}</span></>
                      )}
                      {codexSupport.status === "unsupported" && (
                        <><XCircle size={14} color="#ef4444" /> <span style={{ color: "#ef4444" }}>{codexSupport.text}</span></>
                      )}
                    </span>
                  </div>
                </div>
              </div>
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
                  "Add Permission"
                )}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
