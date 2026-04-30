import { describe, expect, it } from "vitest";

import type { SlashCommandDto, SlashCommandReviewDto, SlashTargetId } from "../api/types";
import {
  bucketSlashCommands,
  countSyncedTargets,
  filterSlashCommands,
  filterSlashReviewRows,
  primaryReviewAction,
  reviewMetaText,
  sortSlashCommands,
} from "./selectors";

describe("slash command selectors", () => {
  const commands: SlashCommandDto[] = [
    command("disabled-command", []),
    command("selective-command", ["codex"]),
    command("enabled-command", ["claude", "codex"]),
  ];

  it("filters, buckets, and counts coverage", () => {
    expect(filterSlashCommands(commands, "selective").map((item) => item.name)).toEqual([
      "selective-command",
    ]);
    expect(countSyncedTargets(commands[2])).toBe(2);
    expect(bucketSlashCommands(commands, 2)).toMatchObject({
      disabled: [{ name: "disabled-command" }],
      selective: [{ name: "selective-command" }],
      enabled: [{ name: "enabled-command" }],
    });
  });

  it("sorts by coverage and target columns", () => {
    expect(sortSlashCommands(commands, { key: "coverage", direction: "desc" }).map((item) => item.name)).toEqual([
      "enabled-command",
      "selective-command",
      "disabled-command",
    ]);
    expect(sortSlashCommands(commands, { key: { target: "codex" }, direction: "desc" }).map((item) => item.name)).toEqual([
      "enabled-command",
      "selective-command",
      "disabled-command",
    ]);
  });

  it("selects review actions and metadata for unmanaged, drifted, and missing rows", () => {
    const rows: SlashCommandReviewDto[] = [
      reviewRow("unmanaged", ["import"]),
      reviewRow("drifted", ["restore_managed", "adopt_target", "remove_binding"]),
      reviewRow("missing", ["restore_managed", "remove_binding"]),
    ];

    expect(filterSlashReviewRows(rows, "drifted").map((row) => row.kind)).toEqual(["drifted"]);
    expect(rows.map((row) => primaryReviewAction(row))).toEqual([
      "import",
      "restore_managed",
      "restore_managed",
    ]);
    expect(rows.map((row) => reviewMetaText(row))).toEqual([
      "Found in Codex",
      "Changed in Codex",
      "Missing from Codex",
    ]);
  });
});

function command(name: string, targets: SlashTargetId[]): SlashCommandDto {
  return {
    name,
    description: name,
    prompt: "$ARGUMENTS",
    syncTargets: targets.map((target) => ({
      target,
      path: `/tmp/${target}/${name}.md`,
      status: "synced",
    })),
  };
}

function reviewRow(kind: SlashCommandReviewDto["kind"], actions: SlashCommandReviewDto["actions"]): SlashCommandReviewDto {
  return {
    reviewRef: `codex:code-review:${kind}`,
    kind,
    target: "codex",
    targetLabel: "Codex",
    name: "code-review",
    path: "/tmp/home/.codex/prompts/code-review.md",
    description: "Review code",
    prompt: "$ARGUMENTS",
    commandExists: kind !== "unmanaged",
    canImport: actions.includes("import"),
    actions,
    error: null,
  };
}
