const LINK_CANDIDATE_RE =
  /https?:\/\/[^\s)]+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s)]*)?/gi;

export function LinkifiedText({ text }: { text: string }) {
  const nodes: Array<string | { text: string; href: string }> = [];
  let cursor = 0;
  for (const match of text.matchAll(LINK_CANDIDATE_RE)) {
    const raw = match[0];
    const start = match.index ?? 0;
    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }
    const trimmed = trimTrailingLinkPunctuation(raw);
    nodes.push({
      text: trimmed.link,
      href: trimmed.link.match(/^https?:\/\//i) ? trimmed.link : `https://${trimmed.link}`,
    });
    if (trimmed.trailing) {
      nodes.push(trimmed.trailing);
    }
    cursor = start + raw.length;
  }
  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return (
    <>
      {nodes.map((node, index) =>
        typeof node === "string" ? (
          node
        ) : (
          <a
            key={`${node.text}-${index}`}
            className="scan-config-panel__hint-link"
            href={node.href}
            target="_blank"
            rel="noreferrer"
          >
            {node.text}
          </a>
        ),
      )}
    </>
  );
}

function trimTrailingLinkPunctuation(value: string): { link: string; trailing: string } {
  const match = value.match(/[.,;:!?]+$/);
  if (!match) {
    return { link: value, trailing: "" };
  }
  return {
    link: value.slice(0, -match[0].length),
    trailing: match[0],
  };
}
