import { render, screen } from "@testing-library/react";
import React from "react";

import { ErrorBoundary } from "./ErrorBoundary";

function Broken(): React.ReactElement {
  throw new Error("No image");
}

describe("ErrorBoundary", () => {
  it("shows what went wrong in place of the part, marked as English", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    spy.mockRestore();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("lang", "en");
    expect(alert).toHaveTextContent("Something went wrong");
    expect(alert).toHaveTextContent("Error message: No image");
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
