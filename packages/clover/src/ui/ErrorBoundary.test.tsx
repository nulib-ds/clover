import { render, screen } from "@testing-library/react";
import React from "react";

import { ErrorBoundary } from "./ErrorBoundary";

function Broken(): React.ReactElement {
  throw new Error("No image");
}

describe("ErrorBoundary", () => {
  it("shows what went wrong in place of the part, the detail marked as English", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    spy.mockRestore();
    const alert = screen.getByRole("alert");
    expect(alert).not.toHaveAttribute("lang");
    expect(alert).toHaveTextContent("This could not be loaded.");
    expect(screen.getByText("No image")).toHaveAttribute("lang", "en");
  });

  it("renders its children when nothing breaks", () => {
    render(
      <ErrorBoundary>
        <p>Fine</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Fine")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
