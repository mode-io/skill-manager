import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ScanPanel from "./ScanPanel";
import type { ScanFinding, ScanResult } from "../../api/scan-types";

function finding(overrides: Partial<ScanFinding>): ScanFinding {
  return {
    id: "finding-1",
    ruleId: "AITech-8.2",
    category: "data_exfiltration",
    severity: "LOW",
    title: "Suspicious behavior",
    description: "The skill has a non-critical concern.",
    filePath: "SKILL.md",
    lineNumber: null,
    metadata: {},
    snippet: null,
    remediation: null,
    analyzer: "llm_analyzer",
    ...overrides,
  };
}

function result(findings: ScanFinding[]): ScanResult {
  return {
    skillName: "test2",
    isSafe: findings.length === 0,
    maxSeverity: findings[0]?.severity ?? "SAFE",
    findingsCount: findings.length,
    findings,
    analyzersUsed: ["llm_analyzer"],
    durationSeconds: 0.4,
  };
}

describe("ScanPanel", () => {
  const llmConfig = {
    name: "test config",
    model: "qwen-plus",
    provider: "openai-compatible",
    baseUrl: "https://example.test/v1",
  };

  it("shows the serious warning only when a critical finding exists", () => {
    render(<ScanPanel result={result([finding({ severity: "CRITICAL" })])} llmConfig={llmConfig} />);

    expect(screen.getByRole("heading", {
      name: "These are serious issues; please delete them immediately!",
    })).toBeInTheDocument();
  });

  it("shows the confidence message for non-critical findings", () => {
    render(
      <ScanPanel
        result={result([
          finding({ id: "finding-high", severity: "HIGH" }),
          finding({ id: "finding-low", severity: "LOW" }),
        ])}
        llmConfig={llmConfig}
      />,
    );

    expect(screen.getByRole("heading", {
      name: "These problems are not serious, you can use it with confidence.",
    })).toBeInTheDocument();
    expect(screen.getByText(/test2 - 0\.4s - 2 Findings/i)).toBeInTheDocument();
    expect(screen.queryByText(/llm_analyzer/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/severity summary/i)).not.toBeInTheDocument();
  });

  it("shows the no-problems message when no findings are detected", () => {
    render(<ScanPanel result={result([])} llmConfig={llmConfig} />);

    expect(screen.getByRole("heading", {
      name: "No problems were detected, please use it with confidence.",
    })).toBeInTheDocument();
    expect(screen.queryByRole("heading", {
      name: "These problems are not serious, you can use it with confidence.",
    })).not.toBeInTheDocument();
    expect(screen.getByText(/test2 - 0\.4s - 0 Findings/i)).toBeInTheDocument();
  });
});
