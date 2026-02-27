import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProjectForm } from "../ProjectForm";

describe("ProjectForm", () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all form fields", () => {
    render(<ProjectForm onSubmit={mockOnSubmit} isLoading={false} />);

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confluence space/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/jira project/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/git repo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/beads project/i)).toBeInTheDocument();
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

  it("calls onSubmit with form data", async () => {
    const user = userEvent.setup();
    render(<ProjectForm onSubmit={mockOnSubmit} isLoading={false} />);

    await user.type(screen.getByLabelText(/name/i), "My Project");
    await user.type(screen.getByLabelText(/description/i), "A great project");
    await user.type(screen.getByLabelText(/confluence space/i), "MYSPACE");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "My Project",
          description: "A great project",
          confluenceSpace: "MYSPACE",
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
      confluenceSpace: "CONF",
      jiraProject: "JIRA-1",
      gitRepo: "https://github.com/org/repo",
      beadsProject: "beads-123",
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
    expect(screen.getByLabelText(/confluence space/i)).toHaveValue("CONF");
    expect(screen.getByLabelText(/jira project/i)).toHaveValue("JIRA-1");
    expect(screen.getByLabelText(/git repo/i)).toHaveValue(
      "https://github.com/org/repo",
    );
    expect(screen.getByLabelText(/beads project/i)).toHaveValue("beads-123");
  });
});
