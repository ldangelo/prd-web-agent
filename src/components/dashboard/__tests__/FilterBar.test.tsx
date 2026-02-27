/**
 * FilterBar component tests.
 *
 * Verifies rendering of filter dropdowns and callback behavior.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterBar } from "../FilterBar";
import type { FilterValues } from "../FilterBar";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const defaultProjects = [
  { id: "proj_001", name: "Project Alpha" },
  { id: "proj_002", name: "Project Beta" },
];

const defaultAuthors = [
  { id: "user_1", name: "Alice" },
  { id: "user_2", name: "Bob" },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FilterBar", () => {
  const onFilterChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render filter dropdowns for project, status, and author", () => {
    render(
      <FilterBar
        projects={defaultProjects}
        authors={defaultAuthors}
        filters={{}}
        onFilterChange={onFilterChange}
      />,
    );

    expect(screen.getByLabelText("Project")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Author")).toBeInTheDocument();
  });

  it("should render tag filter input", () => {
    render(
      <FilterBar
        projects={defaultProjects}
        authors={defaultAuthors}
        filters={{}}
        onFilterChange={onFilterChange}
      />,
    );

    expect(screen.getByLabelText("Tags")).toBeInTheDocument();
  });

  it("should render date range inputs", () => {
    render(
      <FilterBar
        projects={defaultProjects}
        authors={defaultAuthors}
        filters={{}}
        onFilterChange={onFilterChange}
      />,
    );

    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
  });

  it("should call onFilterChange when status filter changes", async () => {
    const user = userEvent.setup();

    render(
      <FilterBar
        projects={defaultProjects}
        authors={defaultAuthors}
        filters={{}}
        onFilterChange={onFilterChange}
      />,
    );

    const statusSelect = screen.getByLabelText("Status");
    await user.selectOptions(statusSelect, "DRAFT");

    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: "DRAFT" }),
    );
  });

  it("should call onFilterChange when project filter changes", async () => {
    const user = userEvent.setup();

    render(
      <FilterBar
        projects={defaultProjects}
        authors={defaultAuthors}
        filters={{}}
        onFilterChange={onFilterChange}
      />,
    );

    const projectSelect = screen.getByLabelText("Project");
    await user.selectOptions(projectSelect, "proj_001");

    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ project: "proj_001" }),
    );
  });

  it("should display all status options", () => {
    render(
      <FilterBar
        projects={defaultProjects}
        authors={defaultAuthors}
        filters={{}}
        onFilterChange={onFilterChange}
      />,
    );

    const statusSelect = screen.getByLabelText("Status");
    const options = statusSelect.querySelectorAll("option");
    // "All" + 4 statuses
    expect(options).toHaveLength(5);
  });
});
