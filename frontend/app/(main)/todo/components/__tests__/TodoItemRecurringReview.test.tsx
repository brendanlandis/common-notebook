import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TodoItemRecurringReview from "../TodoItemRecurringReview";
import type { Todo } from "@/app/types/index";

// Mock RichTextDisplay
vi.mock("@/app/components/RichTextDisplay", () => ({
  default: ({ content }: { content: any }) => (
    <div data-testid="rich-text-display">{JSON.stringify(content)}</div>
  ),
}));

describe("TodoItemRecurringReview", () => {
  const baseTodo: Todo = {
    id: 1,
    documentId: "test-123",
    title: "Test Todo",
    description: [],
    completed: false,
    completedAt: null,
    dueDate: null,
    displayDate: null,
    displayDateOffset: null,
    isRecurring: true,
    recurrenceType: "daily",
    recurrenceInterval: null,
    recurrenceDayOfWeek: null,
    recurrenceDayOfMonth: null,
    recurrenceWeekOfMonth: null,
    recurrenceDayOfWeekMonthly: null,
    recurrenceMonth: null,
    category: null,
    trackingUrl: null,
    purchaseUrl: null,
    price: null,
    wishListCategory: null,
    soon: false,
    long: false,
    workSessions: null,
    project: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    publishedAt: "2024-01-01T00:00:00.000Z",
  };

  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();

  it("should not render a checkbox", () => {
    render(
      <TodoItemRecurringReview
        todo={baseTodo}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    const checkbox = screen.queryByRole("checkbox");
    expect(checkbox).toBeNull();
  });

  it("should not render a skip button", () => {
    render(
      <TodoItemRecurringReview
        todo={baseTodo}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    const skipButton = screen.queryByTitle("skip this one");
    expect(skipButton).toBeNull();
  });

  it("should not render a cookie icon", () => {
    const longTodo = { ...baseTodo, long: true };
    render(
      <TodoItemRecurringReview
        todo={longTodo}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    const cookieButton = screen.queryByTitle("mark as worked on today");
    expect(cookieButton).toBeNull();
  });

  it("should render edit and delete buttons", () => {
    render(
      <TodoItemRecurringReview
        todo={baseTodo}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2); // Edit and delete only
  });

  it("should call onEdit when edit button is clicked", () => {
    render(
      <TodoItemRecurringReview
        todo={baseTodo}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]); // First button is edit

    expect(mockOnEdit).toHaveBeenCalledWith(baseTodo);
  });

  it("should call onDelete when delete button is clicked", () => {
    render(
      <TodoItemRecurringReview
        todo={baseTodo}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]); // Second button is delete

    expect(mockOnDelete).toHaveBeenCalledWith("test-123");
  });

  it("should display 'every day' prefix for daily recurrence", () => {
    render(
      <TodoItemRecurringReview
        todo={baseTodo}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText(/every day:/)).toBeInTheDocument();
    expect(screen.getByText(/Test Todo/)).toBeInTheDocument();
  });

  it("should display 'every X days' prefix for every x days recurrence", () => {
    const todo = {
      ...baseTodo,
      recurrenceType: "every x days" as const,
      recurrenceInterval: 2,
    };
    render(
      <TodoItemRecurringReview
        todo={todo}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText(/every 2 days:/)).toBeInTheDocument();
  });

  it("should display 'every [day]' prefix for weekly recurrence", () => {
    const todo = {
      ...baseTodo,
      recurrenceType: "weekly" as const,
      recurrenceDayOfWeek: 7, // Database uses ISO 8601: 7=Sunday
    };
    render(
      <TodoItemRecurringReview
        todo={todo}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText(/every sunday:/)).toBeInTheDocument();
  });

  it("should display 'every other [day]' prefix for biweekly recurrence", () => {
    const todo = {
      ...baseTodo,
      recurrenceType: "biweekly" as const,
      recurrenceDayOfWeek: 4, // Database uses ISO 8601: 4=Thursday
    };
    render(
      <TodoItemRecurringReview
        todo={todo}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText(/every other thursday:/)).toBeInTheDocument();
  });

  it("should display 'on the [ordinal]' prefix for monthly date recurrence", () => {
    const todo = {
      ...baseTodo,
      recurrenceType: "monthly date" as const,
      recurrenceDayOfMonth: 3,
    };
    render(
      <TodoItemRecurringReview
        todo={todo}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText(/on the 3rd:/)).toBeInTheDocument();
  });

  it("should display '[ordinal] [day]' prefix for monthly day recurrence", () => {
    const todo = {
      ...baseTodo,
      recurrenceType: "monthly day" as const,
      recurrenceWeekOfMonth: 2,
      recurrenceDayOfWeekMonthly: 1, // Database uses ISO 8601: 1=Monday
    };
    render(
      <TodoItemRecurringReview
        todo={todo}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText(/2nd monday:/)).toBeInTheDocument();
  });

  it("should display 'M/D' format prefix for annually recurrence", () => {
    const todo = {
      ...baseTodo,
      recurrenceType: "annually" as const,
      recurrenceMonth: 7, // July
      recurrenceDayOfMonth: 15,
    };
    render(
      <TodoItemRecurringReview
        todo={todo}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText(/7\/15:/)).toBeInTheDocument();
  });

  it("should not display prefix for moon phase recurrences", () => {
    const todoFullMoon = {
      ...baseTodo,
      recurrenceType: "full moon" as const,
      title: "Check moon phase",
    };
    render(
      <TodoItemRecurringReview
        todo={todoFullMoon}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText("Check moon phase")).toBeInTheDocument();
    expect(screen.queryByText(/:/)).not.toBeInTheDocument();
  });

  it("should not display prefix for seasonal recurrences", () => {
    const todoWinterSolstice = {
      ...baseTodo,
      recurrenceType: "winter solstice" as const,
      title: "Celebrate solstice",
    };
    render(
      <TodoItemRecurringReview
        todo={todoWinterSolstice}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText("Celebrate solstice")).toBeInTheDocument();
    expect(screen.queryByText(/:/)).not.toBeInTheDocument();
  });

  it("should render description when present", () => {
    const todoWithDescription = {
      ...baseTodo,
      description: [{ type: "paragraph", children: [{ type: "text", text: "Test description" }] }],
    };
    render(
      <TodoItemRecurringReview
        todo={todoWithDescription}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByTestId("rich-text-display")).toBeInTheDocument();
  });

  it("should not render description when empty", () => {
    render(
      <TodoItemRecurringReview
        todo={baseTodo}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.queryByTestId("rich-text-display")).not.toBeInTheDocument();
  });

  it("should render tracking URL when present", () => {
    const todoWithTracking = {
      ...baseTodo,
      trackingUrl: "https://example.com/track",
    };
    render(
      <TodoItemRecurringReview
        todo={todoWithTracking}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    const trackingLink = screen.getByTitle("tracking url");
    expect(trackingLink).toBeInTheDocument();
    expect(trackingLink).toHaveAttribute("href", "https://example.com/track");
  });

  it("should render purchase URL when present", () => {
    const todoWithPurchase = {
      ...baseTodo,
      purchaseUrl: "https://example.com/buy",
    };
    render(
      <TodoItemRecurringReview
        todo={todoWithPurchase}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    const purchaseLink = screen.getByTitle("purchase url");
    expect(purchaseLink).toBeInTheDocument();
    expect(purchaseLink).toHaveAttribute("href", "https://example.com/buy");
  });

  it("should render price for buy stuff category", () => {
    const todoWithPrice = {
      ...baseTodo,
      category: "buy stuff" as const,
      price: 29.99,
    };
    render(
      <TodoItemRecurringReview
        todo={todoWithPrice}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    expect(screen.getByText(/\$29\.99/)).toBeInTheDocument();
  });

  it("should apply todo-item-recurring-review class", () => {
    const { container } = render(
      <TodoItemRecurringReview
        todo={baseTodo}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    const listItem = container.querySelector("li");
    expect(listItem).toHaveClass("todo-item-recurring-review");
  });

  it("should not have clickable label", () => {
    render(
      <TodoItemRecurringReview
        todo={baseTodo}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
      />
    );

    // Label should be a div, not a label element with htmlFor
    const label = screen.queryByLabelText("mark complete");
    expect(label).toBeNull();
  });
});
