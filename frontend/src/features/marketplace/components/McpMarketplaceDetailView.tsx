import { type ReactNode, useId, useState } from "react";
import { Activity, CheckCircle2, Copy } from "lucide-react";

import { DetailHeader } from "../../../components/detail/DetailHeader";
import { DetailSourceLinks } from "../../../components/detail/DetailSourceLinks";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { LoadingSpinner } from "../../../components/LoadingSpinner";
import { useToast } from "../../../components/Toast";
import { UiTooltip } from "../../../components/ui/UiTooltip";
import { useMcpMarketplaceDetailQuery } from "../api/mcp-queries";
import type { McpMarketplaceItemDto } from "../api/mcp-types";
import { formatMcpUseCount } from "../model/formatters";
import {
  detailInstallAvailability,
  useMcpInstallActionState,
} from "../model/mcp-install-action";
import { McpInstallButton } from "./McpInstallButton";
import { McpToolEntry } from "./McpToolEntry";

interface McpMarketplaceDetailViewProps {
  qualifiedName: string;
  initialItem: McpMarketplaceItemDto | null;
  onClose: () => void;
}

const TOOL_INITIAL_COUNT = 5;

export function McpMarketplaceDetailView({
  qualifiedName,
  initialItem,
  onClose,
}: McpMarketplaceDetailViewProps) {
  const headingId = useId();
  const detailQuery = useMcpMarketplaceDetailQuery(qualifiedName);
  const detail = detailQuery.data ?? null;
  const queryErrorMessage =
    detailQuery.error instanceof Error ? detailQuery.error.message : "";
  const { toast } = useToast();
  const [showAllTools, setShowAllTools] = useState(false);

  const fallbackUseCount = initialItem?.useCount ?? 0;
  const fallbackVerified = initialItem?.isVerified ?? false;
  const headerDisplayName = detail?.displayName ?? initialItem?.displayName ?? qualifiedName;
  const headerIsRemote = detail?.isRemote ?? initialItem?.isRemote ?? false;
  const headerIcon = detail?.iconUrl ?? initialItem?.iconUrl ?? null;
  const headerExternalUrl =
    detail?.externalUrl ?? initialItem?.externalUrl ?? `https://smithery.ai/server/${qualifiedName}`;
  const installAction = useMcpInstallActionState({
    qualifiedName,
    displayName: headerDisplayName,
  });

  if (!detail && detailQuery.isPending) {
    return (
      <>
        <div className="skill-detail__chrome">
          <DetailHeader
            title={<h2 id={headingId}>{headerDisplayName}</h2>}
            meta={<p className="market-card__repo">{qualifiedName}</p>}
            closeLabel="Close MCP preview"
            onClose={onClose}
          />
        </div>
        <div className="skill-detail__body" aria-labelledby={headingId}>
          <div className="panel-state">
            <LoadingSpinner label="Loading MCP details" />
          </div>
        </div>
      </>
    );
  }

  if (!detail) {
    return (
      <>
        <div className="skill-detail__chrome">
          <DetailHeader
            title={<h2 id={headingId}>Unable to load MCP server</h2>}
            closeLabel="Close MCP preview"
            onClose={onClose}
          />
          <ErrorBanner message={queryErrorMessage || "Unable to load MCP server detail."} />
        </div>
        <div className="skill-detail__body" aria-labelledby={headingId}>
          <p className="muted-text">Try reopening the server from the marketplace grid.</p>
        </div>
      </>
    );
  }

  const toolsToShow = showAllTools ? detail.tools : detail.tools.slice(0, TOOL_INITIAL_COUNT);
  const remainingToolCount = detail.tools.length - toolsToShow.length;
  const remoteConnection = detail.connections.find(
    (connection) => connection.kind === "http" || connection.kind === "sse",
  );
  const localConnection = detail.connections.find(
    (connection) => connection.kind === "stdio",
  );
  const installAvailability = detailInstallAvailability(detail);

  function handleCopy(value: string, label: string): void {
    if (!navigator.clipboard?.writeText) {
      toast(`${label} copied`);
      return;
    }
    void navigator.clipboard
      .writeText(value)
      .then(() => toast(`${label} copied`))
      .catch(() => toast("Copy failed"));
  }

  const installButton = (
    <McpInstallButton
      displayName={headerDisplayName}
      availability={installAvailability}
      installedState={installAction.installedState}
      installTargetState={installAction.installTargetState}
      installing={installAction.installing}
      onInstall={installAction.onInstall}
    />
  );

  return (
    <>
      <div className="skill-detail__chrome">
        <DetailHeader
          title={<h2 id={headingId}>{headerDisplayName}</h2>}
          titleAction={installButton}
          meta={
            <div className="mcp-detail__meta-stack">
              <div className="detail-sheet__meta">
                {headerIcon ? (
                  <img
                    className="mcp-detail__icon"
                    src={headerIcon}
                    alt=""
                    onError={(event) => {
                      (event.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : null}
                <code className="mcp-detail__qualified-name">{qualifiedName}</code>
                <span className="detail-sheet__divider" aria-hidden="true">·</span>
                <div className="chip-cluster">
                  <span className={`chip chip--${headerIsRemote ? "remote" : "local"}`}>
                    {headerIsRemote ? "Remote" : "Local"}
                  </span>
                  {fallbackVerified ? (
                    <span className="chip chip--verified">
                      <CheckCircle2 size={12} aria-hidden="true" />
                      Verified
                    </span>
                  ) : null}
                  <UiTooltip content={`${fallbackUseCount.toLocaleString()} calls`}>
                    <span className="mcp-detail__stat">
                      <Activity size={12} aria-hidden="true" />
                      {formatMcpUseCount(fallbackUseCount)}
                    </span>
                  </UiTooltip>
                </div>
              </div>
              <DetailSourceLinks
                ariaLabel={`Source links for ${headerDisplayName}`}
                links={[
                  {
                    href: headerExternalUrl,
                    label: "View on smithery.ai",
                    kind: "marketplace",
                  },
                ]}
              />
            </div>
          }
          closeLabel="Close MCP preview"
          onClose={onClose}
        />
        {queryErrorMessage ? <ErrorBanner message={queryErrorMessage} /> : null}
      </div>

      <div className="skill-detail__body detail-sheet__body" aria-labelledby={headingId}>
        <Section heading="About">
          <AboutBody text={detail.description} />
        </Section>

        {(detail.capabilityCounts.tools > 0 ||
          detail.capabilityCounts.resources > 0 ||
          detail.capabilityCounts.prompts > 0) && (
          <Section heading="Capabilities">
            <div className="chip-cluster mcp-detail__capabilities">
              {detail.capabilityCounts.tools > 0 ? (
                <CapabilityCount label="Tools" count={detail.capabilityCounts.tools} />
              ) : null}
              {detail.capabilityCounts.resources > 0 ? (
                <CapabilityCount label="Resources" count={detail.capabilityCounts.resources} />
              ) : null}
              {detail.capabilityCounts.prompts > 0 ? (
                <CapabilityCount label="Prompts" count={detail.capabilityCounts.prompts} />
              ) : null}
            </div>
          </Section>
        )}

        <Section heading="Connection">
          {remoteConnection ? (
            <div className="mcp-detail__connection">
              <p className="mcp-detail__connection-label">Deployment URL</p>
              <div className="mcp-detail__connection-row">
                <code className="mcp-detail__connection-url">
                  {remoteConnection.deploymentUrl ?? detail.deploymentUrl ?? ""}
                </code>
                <button
                  type="button"
                  className="action-pill mcp-detail__copy"
                  onClick={() =>
                    handleCopy(
                      remoteConnection.deploymentUrl ?? detail.deploymentUrl ?? "",
                      "Deployment URL",
                    )
                  }
                >
                  <Copy size={13} aria-hidden="true" />
                  Copy
                </button>
              </div>
            </div>
          ) : localConnection?.stdioCommand ? (
            <div className="mcp-detail__connection">
              <p className="mcp-detail__connection-label">Local stdio command</p>
              <div className="mcp-detail__connection-row">
                <code className="mcp-detail__connection-url">
                  {[localConnection.stdioCommand, ...(localConnection.stdioArgs ?? [])].join(" ")}
                </code>
                <button
                  type="button"
                  className="action-pill mcp-detail__copy"
                  onClick={() =>
                    handleCopy(
                      [localConnection.stdioCommand, ...(localConnection.stdioArgs ?? [])].join(" "),
                      "Command",
                    )
                  }
                >
                  <Copy size={13} aria-hidden="true" />
                  Copy
                </button>
              </div>
            </div>
          ) : (
            <p className="muted-text">
              The source installer will write the actual local command into the selected harness.
            </p>
          )}
        </Section>

        {detail.tools.length > 0 ? (
          <Section heading={`Tools (${detail.tools.length})`}>
            <div className="mcp-detail__tool-list">
              {toolsToShow.map((tool) => (
                <McpToolEntry key={tool.name} tool={tool} />
              ))}
            </div>
            {remainingToolCount > 0 ? (
              <button
                type="button"
                className="btn btn-ghost mcp-detail__show-more"
                onClick={() => setShowAllTools(true)}
              >
                Show {remainingToolCount} more
              </button>
            ) : null}
            {showAllTools && detail.tools.length > TOOL_INITIAL_COUNT ? (
              <button
                type="button"
                className="btn btn-ghost mcp-detail__show-more"
                onClick={() => setShowAllTools(false)}
              >
                Collapse tools
              </button>
            ) : null}
          </Section>
        ) : null}

        {detail.resources.length > 0 ? (
          <Section heading={`Resources (${detail.resources.length})`}>
            <div className="mcp-detail__resource-list">
              {detail.resources.map((resource, index) => (
                <div key={`${resource.name}-${index}`} className="mcp-detail__resource">
                  <div className="mcp-detail__resource-head">
                    <code>{resource.name || resource.uri}</code>
                    {resource.mimeType ? (
                      <span className="mcp-detail__resource-mime">{resource.mimeType}</span>
                    ) : null}
                  </div>
                  {resource.uri ? <code className="mcp-detail__resource-uri">{resource.uri}</code> : null}
                  {resource.description ? <p>{resource.description}</p> : null}
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        {detail.prompts.length > 0 ? (
          <Section heading={`Prompts (${detail.prompts.length})`}>
            <div className="mcp-detail__prompt-list">
              {detail.prompts.map((prompt, index) => (
                <div key={`${prompt.name}-${index}`} className="mcp-detail__prompt">
                  <code>{prompt.name}</code>
                  {prompt.description ? <p>{prompt.description}</p> : null}
                  {prompt.arguments.length > 0 ? (
                    <ul className="mcp-detail__prompt-args">
                      {prompt.arguments.map((argument) => (
                        <li key={argument.name}>
                          <code>{argument.name}</code>
                          {argument.required ? <span className="mcp-tool__param-required">*</span> : null}
                          {argument.description ? <span>— {argument.description}</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </Section>
        ) : null}
      </div>
    </>
  );
}

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="detail-sheet__section">
      <h3 className="detail-sheet__section-heading">{heading}</h3>
      {children}
    </section>
  );
}

function CapabilityCount({ label, count }: { label: string; count: number }) {
  return (
    <span className="chip chip--capability">
      {label} <strong>{count}</strong>
    </span>
  );
}

const ABOUT_COLLAPSE_LENGTH = 420;

function AboutBody({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const content = text.trim();
  if (!content) {
    return <p className="muted-text">No description provided.</p>;
  }
  const shouldCollapse = content.length > ABOUT_COLLAPSE_LENGTH;
  const visible = expanded || !shouldCollapse ? content : `${content.slice(0, ABOUT_COLLAPSE_LENGTH).trim()}…`;
  return (
    <div>
      <p className="mcp-detail__about">{visible}</p>
      {shouldCollapse ? (
        <button
          type="button"
          className="btn btn-ghost mcp-detail__show-more"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}
