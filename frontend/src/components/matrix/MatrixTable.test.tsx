import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MatrixHarnessHeader } from "./MatrixHarnessHeader";
import { MatrixTable } from "./MatrixTable";

describe("MatrixTable", () => {
  it("renders the shared column structure", () => {
    render(
      <MatrixTable ariaLabel="Example matrix" harnessColumnCount={2}>
        <thead>
          <tr>
            <th>Select</th>
            <th>Name</th>
            <th>Codex</th>
            <th>Claude</th>
            <th>Harnesses</th>
            <th>Active</th>
          </tr>
        </thead>
      </MatrixTable>,
    );

    const table = screen.getByRole("table", { name: "Example matrix" });
    const cols = table.querySelectorAll("col");

    expect(table).toHaveClass("matrix-table");
    expect(table).not.toHaveClass("matrix-table--panel");
    expect(table.closest(".matrix-table-wrapper")).not.toHaveClass("matrix-table-wrapper--panel");
    expect(cols).toHaveLength(6);
    expect(cols[0]).toHaveClass("matrix-table__col-checkbox");
    expect(cols[1]).toHaveClass("matrix-table__col-identity");
    expect(cols[2]).toHaveClass("matrix-table__col-harness");
    expect(cols[3]).toHaveClass("matrix-table__col-harness");
    expect(cols[4]).toHaveClass("matrix-table__col-compact");
    expect(cols[5]).toHaveClass("matrix-table__col-coverage");
  });

  it("renders harness headers through the centered matrix target", () => {
    render(
      <table>
        <thead>
          <tr>
            <MatrixHarnessHeader label="Codex" logoKey="codex" harness="codex" />
          </tr>
        </thead>
      </table>,
    );

    const trigger = screen.getByLabelText("Codex");
    expect(trigger).toHaveClass("matrix-harness-target");
    expect(trigger).toHaveClass("matrix-harness-target--header");
  });
});
