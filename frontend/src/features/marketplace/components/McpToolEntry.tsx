import type { McpParameterDto, McpToolDto } from "../api/mcp-types";

interface McpToolEntryProps {
  tool: McpToolDto;
}

export function McpToolEntry({ tool }: McpToolEntryProps) {
  const params = tool.parameters;
  const description = tool.description.trim();

  return (
    <article className="mcp-tool">
      <header className="mcp-tool__header">
        <code className="mcp-tool__name">{tool.name}</code>
      </header>
      {description ? (
        <pre className="mcp-tool__description">{description}</pre>
      ) : null}
      {params.length > 0 ? (
        <div className="mcp-tool__params-wrap">
          <h5 className="mcp-tool__params-heading">Parameters</h5>
          <div className="mcp-tool__params" role="list">
            {params.map((param) => (
              <McpParameterRow key={param.name} param={param} />
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function McpParameterRow({ param }: { param: McpParameterDto }) {
  const annotations = collectAnnotations(param);
  return (
    <div className="mcp-tool__param" role="listitem">
      <div className="mcp-tool__param-name">
        <code>{param.name}</code>
        {param.required ? (
          <span className="mcp-tool__param-required" aria-label="required">*</span>
        ) : null}
      </div>
      <code className="mcp-tool__param-type">{param.type}</code>
      <div className="mcp-tool__param-body">
        {param.description ? <p>{param.description}</p> : <p className="muted-text">No description.</p>}
        {annotations.length > 0 ? (
          <p className="mcp-tool__param-annotations">{annotations.join(" · ")}</p>
        ) : null}
      </div>
    </div>
  );
}

function collectAnnotations(param: McpParameterDto): string[] {
  const out: string[] = [];
  if (param.default !== undefined) {
    out.push(`default: ${formatValue(param.default)}`);
  }
  if (param.minimum !== undefined) {
    out.push(`min: ${param.minimum}`);
  }
  if (param.maximum !== undefined) {
    out.push(`max: ${param.maximum}`);
  }
  if (param.minItems !== undefined) {
    out.push(`minItems: ${param.minItems}`);
  }
  if (param.maxItems !== undefined) {
    out.push(`maxItems: ${param.maxItems}`);
  }
  if (param.minLength !== undefined) {
    out.push(`minLength: ${param.minLength}`);
  }
  if (param.maxLength !== undefined) {
    out.push(`maxLength: ${param.maxLength}`);
  }
  if (param.enum && param.enum.length > 0) {
    const preview = param.enum.slice(0, 4).map(formatValue).join(", ");
    out.push(
      param.enum.length > 4 ? `enum: ${preview}, …` : `enum: ${preview}`,
    );
  }
  return out;
}

function formatValue(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return `"${value}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}
