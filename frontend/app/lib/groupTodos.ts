import type { Project, Todo, TodoCategory } from "@/app/types/index";
import { parseInEST } from "@/app/lib/dateUtils";
import type { TodoGroup } from "@/app/lib/layoutTransformers";

export interface GroupedTodos {
  projects: Project[];
  categoryGroups: TodoGroup[];
  incidentals: Todo[];
  recurringProjects: Project[];
  recurringCategoryGroups: TodoGroup[];
  recurringIncidentals: Todo[];
  allRecurringProjects: Project[];
  allRecurringCategoryGroups: TodoGroup[];
  allRecurringIncidentals: Todo[];
}

// Pure function: group a flat list of todos into the shape RawTodoData expects.
// `todos` is assumed to already be visibility-filtered and phase-enriched.
// `today` is used to filter recurring todos by displayDate (unfiltered set is
// also returned for the recurring-review view).
export function groupTodosForLayout(todos: Todo[], today: Date): GroupedTodos {
  const allRecurringTodosUnfiltered = todos.filter((todo) => todo.isRecurring);

  const recurringTodos = todos.filter((todo) => {
    if (!todo.isRecurring) return false;
    if (!todo.displayDate) return true;
    const startDate = parseInEST(todo.displayDate);
    return startDate <= today;
  });
  const nonRecurringTodos = todos.filter((todo) => !todo.isRecurring);

  // Non-recurring: group by project, then by category, then incidentals
  const projectMap = new Map<string, Project>();
  const todosWithoutProjects: Todo[] = [];

  nonRecurringTodos.forEach((todo) => {
    if (todo.project) {
      const project = todo.project as any;
      if (!projectMap.has(project.documentId)) {
        projectMap.set(project.documentId, { ...project, todos: [] });
      }
      projectMap.get(project.documentId)!.todos!.push(todo);
    } else {
      todosWithoutProjects.push(todo);
    }
  });

  const categoryMap = new Map<TodoCategory, Todo[]>();
  const incidentalTodos: Todo[] = [];

  todosWithoutProjects.forEach((todo) => {
    if (todo.category) {
      if (!categoryMap.has(todo.category)) {
        categoryMap.set(todo.category, []);
      }
      categoryMap.get(todo.category)!.push(todo);
    } else {
      incidentalTodos.push(todo);
    }
  });

  // Recurring (filtered): group by project, then by category, then incidentals
  const recurringProjectMap = new Map<string, Project>();
  const recurringTodosWithoutProjects: Todo[] = [];

  recurringTodos.forEach((todo) => {
    if (todo.project) {
      const project = todo.project as any;
      if (!recurringProjectMap.has(project.documentId)) {
        recurringProjectMap.set(project.documentId, { ...project, todos: [] });
      }
      recurringProjectMap.get(project.documentId)!.todos!.push(todo);
    } else {
      recurringTodosWithoutProjects.push(todo);
    }
  });

  const recurringCategoryMap = new Map<TodoCategory, Todo[]>();
  const recurringIncidentalTodos: Todo[] = [];

  recurringTodosWithoutProjects.forEach((todo) => {
    if (todo.category) {
      if (!recurringCategoryMap.has(todo.category)) {
        recurringCategoryMap.set(todo.category, []);
      }
      recurringCategoryMap.get(todo.category)!.push(todo);
    } else {
      recurringIncidentalTodos.push(todo);
    }
  });

  // Recurring (unfiltered): same shape, used for the recurring-review view
  const allRecurringProjectMap = new Map<string, Project>();
  const allRecurringTodosWithoutProjects: Todo[] = [];

  allRecurringTodosUnfiltered.forEach((todo) => {
    if (todo.project) {
      const project = todo.project as any;
      if (!allRecurringProjectMap.has(project.documentId)) {
        allRecurringProjectMap.set(project.documentId, { ...project, todos: [] });
      }
      allRecurringProjectMap.get(project.documentId)!.todos!.push(todo);
    } else {
      allRecurringTodosWithoutProjects.push(todo);
    }
  });

  const allRecurringCategoryMap = new Map<TodoCategory, Todo[]>();
  const allRecurringIncidentalTodos: Todo[] = [];

  allRecurringTodosWithoutProjects.forEach((todo) => {
    if (todo.category) {
      if (!allRecurringCategoryMap.has(todo.category)) {
        allRecurringCategoryMap.set(todo.category, []);
      }
      allRecurringCategoryMap.get(todo.category)!.push(todo);
    } else {
      allRecurringIncidentalTodos.push(todo);
    }
  });

  return {
    projects: Array.from(projectMap.values()),
    categoryGroups: Array.from(categoryMap.entries()).map(([title, todos]) => ({
      title,
      todos,
    })),
    incidentals: incidentalTodos,
    recurringProjects: Array.from(recurringProjectMap.values()),
    recurringCategoryGroups: Array.from(recurringCategoryMap.entries()).map(
      ([title, todos]) => ({ title, todos })
    ),
    recurringIncidentals: recurringIncidentalTodos,
    allRecurringProjects: Array.from(allRecurringProjectMap.values()),
    allRecurringCategoryGroups: Array.from(allRecurringCategoryMap.entries()).map(
      ([title, todos]) => ({ title, todos })
    ),
    allRecurringIncidentals: allRecurringIncidentalTodos,
  };
}
