import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectForm } from "../ProjectForm";

// Mock the RepoPicker component
jest.mock("../RepoPicker", () => ({
  RepoPicker: ({ value, onChange, disabled }: any) => (
    <div data-testid="repo-picker">
      {value ? (
        <div>
          <span data-testid="repo-picker-value">{value}</span>
          <button
            type="button"
            data-testid="repo-picker-clear"
            onClick={() => onChange(null)}
            disabled={disabled}
          >
            Clear
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-testid="repo-picker-select"
          onClick={() =>
            onChange({
              name: "test-repo",
              fullName: "org/test-repo",
              description: "A test repo",
              private: false,
            })
          }
          disabled={disabled}
        >
          Select Repo
        </button>
      )}
    </div>
  ),
}));

describe("ProjectForm", () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all form fields", () => {
    render(<ProjectForm onSubmit={mockOnSubmit} isLoading={false} />);

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByTestId("repo-picker")).toBeInTheDocument();
    expect(screen.getByLabelText(/default labels/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/default reviewers/i)).toBeInTheDocument();
  });

  it("renders name field as required", () => {
    render(<ProjectForm onSubmit={mockOnSubmit} isLoading={false} />);
    expect(screen.getByLabelText(/name/i)).toBeRequired();
  });

  it("renders save button", () => {
    render(<ProjectForm onSubmit={mockOnSubmit} isLoading={false} />);
    expect(
      screen.getByRole("button", { name: /save/i }),
    ).toBeInTheDocument();
  });

  it("calls onSubmit with form data including githubRepo", async () => {
    const user = userEvent.setup();
    render(<ProjectForm onSubmit={mockOnSubmit} isLoading={false} />);

    await user.type(screen.getByLabelText(/name/i), "My Project");
    await user.type(screen.getByLabelText(/description/i), "A great project");
    await user.click(screen.getByTestId("repo-picker-select"));
    await user.type(screen.getByLabelText(/default labels/i), "bug, enhancement");
    await user.type(screen.getByLabelText(/default reviewers/i), "user1, user2");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "My Project",
          description: "A great project",
          githubRepo: "org/test-repo",
          defaultLabels: ["bug", "enhancement"],
          defaultReviewers: ["user1", "user2"],
        }),
      );
    });
  });

  it("shows loading state", () => {
    render(<ProjectForm onSubmit={mockOnSubmit} isLoading={true} />);

    const button = screen.getByRole("button", { name: /saving/i });
    expect(button).toBeDisabled();
  });

  it("populates initial data when provided", () => {
    const initialData = {
      name: "Existing Project",
      description: "Existing description",
      githubRepo: "org/existing-repo",
      defaultLabels: ["label1", "label2"],
      defaultReviewers: ["reviewer1"],
    };

    render(
      <ProjectForm
        initialData={initialData}
        onSubmit={mockOnSubmit}
        isLoading={false}
      />,
    );

    expect(screen.getByLabelText(/name/i)).toHaveValue("Existing Project");
    expect(screen.getByLabelText(/description/i)).toHaveValue(
      "Existing description",
    );
    expect(screen.getByTestId("repo-picker-value")).toHaveTextContent(
      "org/existing-repo",
    );
    expect(screen.getByLabelText(/default labels/i)).toHaveValue(
      "label1, label2",
    );
    expect(screen.getByLabelText(/default reviewers/i)).toHaveValue(
      "reviewer1",
    );
  });

  it("clears githubRepo when RepoPicker is cleared", async () => {
    const user = userEvent.setup();
    const initialData = {
      name: "Test",
      githubRepo: "org/existing-repo",
      defaultLabels: [] as string[],
      defaultReviewers: [] as string[],
    };

    render(
      <ProjectForm
        initialData={initialData}
        onSubmit={mockOnSubmit}
        isLoading={false}
      />,
    );

    await user.click(screen.getByTestId("repo-picker-clear"));
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          githubRepo: "",
        }),
      );
    });
  });
});
