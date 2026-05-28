type McpSourceKind = "marketplace" | "adopted" | "manual";
type McpSourceLinkKind = "repo" | "marketplace" | "website";

export interface McpSourceLink {
  href?: string | null;
  label: string;
  kind?: McpSourceLinkKind;
  disabledReason?: string;
  disabledAriaLabel?: string;
}

export interface McpSourceLinkCopy {
  viewInRegistry: string;
  github: string;
  website: string;
  unavailableLink: (label: string) => string;
  noRegistryLink: string;
  noGithubLink: string;
  noWebsiteLink: string;
}

export function resolveMcpRegistryName({
  fallbackName,
  sourceKind,
  sourceLocator,
  linkedQualifiedName,
}: {
  fallbackName: string;
  sourceKind?: McpSourceKind | null;
  sourceLocator?: string | null;
  linkedQualifiedName?: string | null;
}): string {
  const linkedName = nonBlank(linkedQualifiedName);
  if (linkedName) return linkedName;

  const locator = nonBlank(sourceLocator);
  if (sourceKind === "marketplace" && locator) return locator;

  return fallbackName;
}

export function registrySearchUrl(name: string): string {
  return `https://registry.modelcontextprotocol.io/?${new URLSearchParams({ q: name }).toString()}`;
}

export function mcpServerSourceLinks({
  registryExternalUrl,
  registryName,
  hasRegistryIdentity,
  githubUrl,
  websiteUrl,
  copy,
}: {
  registryExternalUrl?: string | null;
  registryName: string;
  hasRegistryIdentity: boolean;
  githubUrl?: string | null;
  websiteUrl?: string | null;
  copy: McpSourceLinkCopy;
}): McpSourceLink[] {
  const registryUrl = nonBlank(registryExternalUrl) ?? (hasRegistryIdentity ? registrySearchUrl(registryName) : null);

  return [
    {
      href: registryUrl,
      label: copy.viewInRegistry,
      kind: "marketplace",
      disabledReason: copy.noRegistryLink,
      disabledAriaLabel: copy.unavailableLink(copy.viewInRegistry),
    },
    {
      href: githubUrl,
      label: copy.github,
      kind: "repo",
      disabledReason: copy.noGithubLink,
      disabledAriaLabel: copy.unavailableLink(copy.github),
    },
    {
      href: websiteUrl,
      label: copy.website,
      kind: "website",
      disabledReason: copy.noWebsiteLink,
      disabledAriaLabel: copy.unavailableLink(copy.website),
    },
  ];
}

function nonBlank(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}
