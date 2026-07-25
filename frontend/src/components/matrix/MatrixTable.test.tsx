import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MatrixHarnessHeader } from "./MatrixHarnessHeader";
import { MatrixTable } from "./MatrixTable";

describe("MatrixTable", () => {
  it("declares no columns of its own so widths follow the rendered cells", () => {
    render(
      <MatrixTable ariaLabel="Example matrix">
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

    expect(table).toHaveClass("matrix-table");
    expect(table).not.toHaveClass("matrix-table--panel");
    expect(table.closest(".matrix-table-wrapper")).not.toHaveClass("matrix-table-wrapper--panel");
    // A colgroup has to mirror exactly which cells each view renders, including
    // the ones `display: none` drops per breakpoint. It never did, so trailing
    // cells landed one column early. Widths come from the th classes instead.
    expect(table.querySelector("colgroup")).toBeNull();
    expect(table.querySelectorAll("col")).toHaveLength(0);
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
