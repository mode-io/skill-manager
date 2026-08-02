import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { McpBindingDto, McpInventoryColumnDto } from "../api/management-types";
import { McpHarnessLogoStack } from "./McpHarnessLogoStack";

describe("McpHarnessLogoStack", () => {
  const columns: McpInventoryColumnDto[] = [
    { harness: "codex", label: "Codex", logoKey: "codex", installed: true, configPresent: true, mcpWritable: true },
    { harness: "claude", label: "Claude", logoKey: "claude", installed: true, configPresent: true, mcpWritable: true },
    { harness: "cursor", label: "Cursor", logoKey: "cursor", installed: true, configPresent: true, mcpWritable: true },
    {
      harness: "openclaw",
      label: "OpenClaw",
      logoKey: "openclaw",
      installed: true,
      configPresent: true,
      mcpWritable: false,
    },
  ];
  const bindings: McpBindingDto[] = [
    { harness: "codex", state: "managed" },
    { harness: "claude", state: "missing" },
  ];

  it("renders only active writable harnesses by default", () => {
    const { container } = render(
      <McpHarnessLogoStack columns={columns} bindings={bindings} />,
    );

    const stackItems = Array.from(container.querySelectorAll(".harness-stack__item"));

    expect(stackItems).toHaveLength(1);
    expect(stackItems[0]).toHaveAttribute("data-state", "enabled");
    expect(container.querySelector(".skill-card__harness-count")).toHaveTextContent("1/3");
  });

  it("renders every writable harness and marks missing bindings as disabled when requested", () => {
    const { container } = render(
      <McpHarnessLogoStack
        showAllWritable
        columns={columns}
        bindings={bindings}
      />,
    );

    const stackItems = Array.from(container.querySelectorAll(".harness-stack__item"));

    expect(stackItems).toHaveLength(3);
    expect(stackItems.map((item) => item.getAttribute("data-state"))).toEqual([
      "enabled",
      "disabled",
      "disabled",
    ]);
    expect(container.querySelector(".skill-card__harness-count")).toHaveTextContent("1/3");
  });
});
