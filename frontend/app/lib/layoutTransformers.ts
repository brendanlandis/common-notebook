import type { Project, Todo, TodoCategory, World } from "@/app/types/admin";
import type { LayoutRuleset } from "@/app/types/layoutRuleset";
import { getTodayInEST, parseInEST, formatInEST, toISODateInEST, toZonedTime } from "@/app/lib/dateUtils";
import { getTimezone } from "@/app/lib/timezoneConfig";
import { addDays } from "date-fns";

export interface TodoGroup {
  title: string;
  todos: Todo[];
}

export type Section = Project | TodoGroup;

export interface TransformedLayout {
  recurringSections?: Section[];
  recurringIncidentals?: Todo[];
  nonRecurringSections?: Section[];
  nonRecurringIncidentals?: Todo[];
  allSections?: Section[];
  incidentals?: Todo[];
  worldSections?: Map<World, { 
    topOfMindAndCategories: Section[];
    normal: Section[];
    later: Section[];
    incidentals: Todo[];
  }>;
  combinedSections?: Section[];
  combinedIncidentals?: Todo[];
  topOfMindSections?: Section[];
  topOfMindIncidentals?: Todo[];
  nonRecurringNoProjectSections?: Section[];
  nonRecurringNoProjectIncidentals?: Todo[];
  rouletteTodos?: Todo[];
  upcomingTodosByDay?: TodoGroup[];
}

export interface RawTodoData {
  projects: Project[];
  categoryGroups: TodoGroup[];
  incidentals: Todo[];
  recurringProjects: Project[];
  recurringCategoryGroups: TodoGroup[];
  recurringIncidentals: Todo[];
  completedTodos?: Todo[];
  upcomingTodos?: Todo[];
  longTodosWithSessions?: Todo[];
}

// Helper function to determine a todo's world
function getTodoWorld(todo: Todo): World {
  // If todo has a project, use project's world
  if (todo.project && (todo.project as any).world) {
    return (todo.project as any).world;
  }

  // If no project but has category, map category to world
  if (todo.category) {
    if (todo.category === "home chores" || todo.category === "life chores") {
      return "life stuff";
    } else if (todo.category === "studio chores" || todo.category === "band chores") {
      return "music admin";
    } else if (todo.category === "work chores") {
      return "day job";
    } else if (todo.category === "web chores" || todo.category === "data chores" || todo.category === "computer chores") {
      return "computer";
    }
  }

  // Default: incidentals go to 'life stuff'
  return "life stuff";
}

// Filter a single todo based on ruleset
function shouldIncludeTodo(todo: Todo, ruleset: LayoutRuleset, getWorld: (todo: Todo) => World): boolean {
  // "in the mail", "buy stuff", "wishlist", and "errands" categories should only appear in the "stuff" layout
  if ((todo.category === "in the mail" || todo.category === "buy stuff" || todo.category === "wishlist" || todo.category === "errands") && ruleset.id !== "stuff") {
    return false;
  }

  // Filter by recurring/non-recurring
  if (todo.isRecurring && !ruleset.showRecurring) {
    return false;
  }
  if (!todo.isRecurring && !ruleset.showNonRecurring) {
    return false;
  }

  // Filter non-recurring todos by displayDate
  // Recurring todos are already filtered by displayDate at the source
  if (!todo.isRecurring && todo.displayDate) {
    const today = getTodayInEST();
    const displayDate = parseInEST(todo.displayDate);
    if (displayDate > today) {
      return false;
    }
  }

  // Filter by world
  if (ruleset.visibleWorlds !== null) {
    const world = getWorld(todo);
    if (!ruleset.visibleWorlds.includes(world)) {
      return false;
    }
  }

  // Filter by category
  if (ruleset.visibleCategories !== null) {
    if (!todo.category || !ruleset.visibleCategories.includes(todo.category)) {
      return false;
    }
  }

  return true;
}

// Filter todos from a section
function filterSectionTodos(section: Section, ruleset: LayoutRuleset, getWorld: (todo: Todo) => World): Section | null {
  const todos = "documentId" in section ? section.todos || [] : section.todos;
  const filteredTodos = todos.filter((todo) => shouldIncludeTodo(todo, ruleset, getWorld));

  if (filteredTodos.length === 0) {
    return null;
  }

  if ("documentId" in section) {
    // It's a Project
    return {
      ...section,
      todos: filteredTodos,
    };
  } else {
    // It's a TodoGroup
    return {
      ...section,
      todos: filteredTodos,
    };
  }
}

// Sort todos within a section
function sortTodos(todos: Todo[], sortBy: LayoutRuleset["sortBy"]): Todo[] {
  const sorted = [...todos];
  switch (sortBy) {
    case "alphabetical":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "creationDate":
      return sorted.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateA - dateB;
      });
    case "dueDate":
      return sorted.sort((a, b) => {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        // Put todos without dates at the end
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return dateA - dateB;
      });
    case "completedAt":
      return sorted.sort((a, b) => {
        const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        // Put todos without completedAt at the end
        if (!a.completedAt && !b.completedAt) return 0;
        if (!a.completedAt) return 1;
        if (!b.completedAt) return -1;
        // Sort descending (most recent first)
        return dateB - dateA;
      });
    default:
      return sorted;
  }
}

// Sort sections
function sortSections(sections: Section[], sortBy: LayoutRuleset["sortBy"]): Section[] {
  const sorted = [...sections];
  switch (sortBy) {
    case "alphabetical":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "creationDate":
      return sorted.sort((a, b) => {
        // For sections, use the first todo's creation date, or section's createdAt if it's a project
        let dateA: number;
        let dateB: number;

        if ("documentId" in a) {
          // Project - use project's createdAt or first todo's createdAt
          dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          if (a.todos && a.todos.length > 0) {
            const todoDate = new Date(a.todos[0].createdAt).getTime();
            dateA = dateA === 0 ? todoDate : Math.min(dateA, todoDate);
          }
        } else {
          // TodoGroup - use first todo's createdAt
          dateA = a.todos.length > 0 ? new Date(a.todos[0].createdAt).getTime() : 0;
        }

        if ("documentId" in b) {
          dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          if (b.todos && b.todos.length > 0) {
            const todoDate = new Date(b.todos[0].createdAt).getTime();
            dateB = dateB === 0 ? todoDate : Math.min(dateB, todoDate);
          }
        } else {
          dateB = b.todos.length > 0 ? new Date(b.todos[0].createdAt).getTime() : 0;
        }

        return dateA - dateB;
      });
    case "dueDate":
      return sorted.sort((a, b) => {
        // For sections, use the earliest due date from todos
        let dateA: number = Infinity;
        let dateB: number = Infinity;

        if ("documentId" in a && a.todos) {
          a.todos.forEach((todo) => {
            if (todo.dueDate) {
              const date = new Date(todo.dueDate).getTime();
              dateA = Math.min(dateA, date);
            }
          });
        } else if (!("documentId" in a)) {
          a.todos.forEach((todo) => {
            if (todo.dueDate) {
              const date = new Date(todo.dueDate).getTime();
              dateA = Math.min(dateA, date);
            }
          });
        }

        if ("documentId" in b && b.todos) {
          b.todos.forEach((todo) => {
            if (todo.dueDate) {
              const date = new Date(todo.dueDate).getTime();
              dateB = Math.min(dateB, date);
            }
          });
        } else if (!("documentId" in b)) {
          b.todos.forEach((todo) => {
            if (todo.dueDate) {
              const date = new Date(todo.dueDate).getTime();
              dateB = Math.min(dateB, date);
            }
          });
        }

        // Put sections without dates at the end
        if (dateA === Infinity && dateB === Infinity) return 0;
        if (dateA === Infinity) return 1;
        if (dateB === Infinity) return -1;
        return dateA - dateB;
      });
    default:
      return sorted;
  }
}

// Main transformation function
export function transformLayout(data: RawTodoData, ruleset: LayoutRuleset): TransformedLayout {
  // Filter and prepare data
  const filteredRecurringProjects = data.recurringProjects
    .map((project) => filterSectionTodos(project, ruleset, getTodoWorld))
    .filter((section): section is Section => section !== null);

  const filteredRecurringCategoryGroups = data.recurringCategoryGroups
    .map((group) => filterSectionTodos(group, ruleset, getTodoWorld))
    .filter((group): group is TodoGroup => group !== null);

  const filteredRecurringIncidentals = data.recurringIncidentals.filter((todo) =>
    shouldIncludeTodo(todo, ruleset, getTodoWorld)
  );

  const filteredProjects = data.projects
    .map((project) => filterSectionTodos(project, ruleset, getTodoWorld))
    .filter((section): section is Section => section !== null);

  const filteredCategoryGroups = data.categoryGroups
    .map((group) => filterSectionTodos(group, ruleset, getTodoWorld))
    .filter((group): group is TodoGroup => group !== null);

  const filteredIncidentals = data.incidentals.filter((todo) =>
    shouldIncludeTodo(todo, ruleset, getTodoWorld)
  );

  // Sort todos within sections
  const sortTodosInSection = (section: Section): Section => {
    if ("documentId" in section) {
      return {
        ...section,
        todos: section.todos ? sortTodos(section.todos, ruleset.sortBy) : [],
      };
    } else {
      return {
        ...section,
        todos: sortTodos(section.todos, ruleset.sortBy),
      };
    }
  };

  const sortedRecurringProjects = filteredRecurringProjects.map(sortTodosInSection);
  const sortedRecurringCategoryGroups = filteredRecurringCategoryGroups.map(sortTodosInSection);
  const sortedRecurringIncidentals = sortTodos(filteredRecurringIncidentals, ruleset.sortBy);

  const sortedProjects = filteredProjects.map(sortTodosInSection);
  const sortedCategoryGroups = filteredCategoryGroups.map(sortTodosInSection);
  const sortedIncidentals = sortTodos(filteredIncidentals, ruleset.sortBy);

  // Apply grouping based on ruleset
  if (ruleset.groupBy === "recurring-separate") {
    return {
      recurringSections: sortSections(
        [...sortedRecurringProjects, ...sortedRecurringCategoryGroups],
        ruleset.sortBy
      ),
      recurringIncidentals:
        sortedRecurringIncidentals.length > 0 ? sortedRecurringIncidentals : undefined,
      nonRecurringSections: sortSections([...sortedProjects, ...sortedCategoryGroups], ruleset.sortBy),
      nonRecurringIncidentals: sortedIncidentals.length > 0 ? sortedIncidentals : undefined,
    };
  } else if (ruleset.groupBy === "recurring-separate-world") {
    // Recurring sections first (unchanged)
    const recurringSections = sortSections(
      [...sortedRecurringProjects, ...sortedRecurringCategoryGroups],
      ruleset.sortBy
    );

    // Group non-recurring by world
    const nonRecurringWorldMap = new Map<World, { 
      topOfMindAndCategories: Section[];
      normal: Section[];
      later: Section[];
      incidentals: Todo[];
    }>();

    // Initialize worlds
    const worlds: World[] = ["make music", "music admin", "life stuff", "day job", "computer"];
    worlds.forEach((world) => {
      nonRecurringWorldMap.set(world, { 
        topOfMindAndCategories: [],
        normal: [],
        later: [],
        incidentals: [] 
      });
    });

    // Group non-recurring projects by world and importance
    sortedProjects.forEach((project) => {
      if ("documentId" in project) {
        const world = project.world || "life stuff";
        const worldData = nonRecurringWorldMap.get(world);
        if (worldData) {
          const importance = project.importance || "normal";
          if (importance === "top of mind") {
            worldData.topOfMindAndCategories.push(project);
          } else if (importance === "later") {
            worldData.later.push(project);
          } else {
            worldData.normal.push(project);
          }
        }
      }
    });

    // Group non-recurring category groups by world (always go with top of mind)
    sortedCategoryGroups.forEach((group) => {
      if (group.todos && group.todos.length > 0) {
        const world = getTodoWorld(group.todos[0]);
        const worldData = nonRecurringWorldMap.get(world);
        if (worldData) {
          worldData.topOfMindAndCategories.push(group);
        }
      }
    });

    // Process non-recurring incidentals - add to topOfMindAndCategories
    const incidentalsByWorld = new Map<World, Todo[]>();
    sortedIncidentals.forEach((todo) => {
      const world = getTodoWorld(todo);
      if (!incidentalsByWorld.has(world)) {
        incidentalsByWorld.set(world, []);
      }
      incidentalsByWorld.get(world)!.push(todo);
    });

    // Sort sections within each world, with special ordering for topOfMindAndCategories
    nonRecurringWorldMap.forEach((worldData, world) => {
      // Sort top of mind and categories: top of mind projects first, then categories
      const topOfMindProjects: Section[] = [];
      const categoryGroups: Section[] = [];
      
      worldData.topOfMindAndCategories.forEach((section) => {
        if ("documentId" in section) {
          // It's a Project (should be top of mind since we filtered by importance)
          topOfMindProjects.push(section);
        } else {
          // It's a TodoGroup (category)
          categoryGroups.push(section);
        }
      });
      
      // Sort each group
      const sortedTopOfMind = sortSections(topOfMindProjects, ruleset.sortBy);
      const sortedCategories = sortSections(categoryGroups, ruleset.sortBy);
      
      // Combine: top of mind projects, then categories
      worldData.topOfMindAndCategories = [...sortedTopOfMind, ...sortedCategories];
      
      // Add incidentals (they'll be rendered with topOfMindAndCategories via the incidentals prop)
      const worldIncidentals = incidentalsByWorld.get(world) || [];
      worldData.incidentals = sortTodos(worldIncidentals, ruleset.sortBy);
      
      // Sort normal and later sections
      worldData.normal = sortSections(worldData.normal, ruleset.sortBy);
      worldData.later = sortSections(worldData.later, ruleset.sortBy);
    });

    return {
      recurringSections,
      recurringIncidentals:
        sortedRecurringIncidentals.length > 0 ? sortedRecurringIncidentals : undefined,
      worldSections: nonRecurringWorldMap,
    };
  } else if (ruleset.groupBy === "merged") {
    // Merge recurring and non-recurring projects
    const mergedProjects = new Map<string, Project>();

    [...sortedRecurringProjects, ...sortedProjects].forEach((project) => {
      if ("documentId" in project) {
        const existing = mergedProjects.get(project.documentId);
        if (existing) {
          mergedProjects.set(project.documentId, {
            ...existing,
            todos: [...(existing.todos || []), ...(project.todos || [])],
          });
        } else {
          mergedProjects.set(project.documentId, { ...project });
        }
      }
    });

    // Merge recurring and non-recurring category groups
    const mergedCategoryGroups = new Map<string, TodoGroup>();

    [...sortedRecurringCategoryGroups, ...sortedCategoryGroups].forEach((group) => {
      const existing = mergedCategoryGroups.get(group.title);
      if (existing) {
        mergedCategoryGroups.set(group.title, {
          ...existing,
          todos: [...existing.todos, ...(group.todos || [])],
        });
      } else {
        mergedCategoryGroups.set(group.title, { 
          title: group.title,
          todos: group.todos || []
        });
      }
    });

    // Merge incidentals
    const mergedIncidentals = [...sortedRecurringIncidentals, ...sortedIncidentals];

    // Combine all sections and sort
    const allSections: Section[] = sortSections(
      [...Array.from(mergedProjects.values()), ...Array.from(mergedCategoryGroups.values())],
      ruleset.sortBy
    );

    // Sort merged incidentals
    const sortedMergedIncidentals = sortTodos(mergedIncidentals, ruleset.sortBy);

    return {
      allSections,
      incidentals: sortedMergedIncidentals.length > 0 ? sortedMergedIncidentals : undefined,
    };
  } else if (ruleset.groupBy === "single-section") {
    // Combine all todos from all sources into a single flat list
    const allTodos: Todo[] = [];

    // Collect todos from all projects (recurring and non-recurring)
    [...sortedRecurringProjects, ...sortedProjects].forEach((project) => {
      if ("documentId" in project && project.todos) {
        allTodos.push(...project.todos);
      }
    });

    // Collect todos from all category groups (recurring and non-recurring)
    [...sortedRecurringCategoryGroups, ...sortedCategoryGroups].forEach((group) => {
      if (group.todos) {
        allTodos.push(...group.todos);
      }
    });

    // Collect all incidentals (recurring and non-recurring)
    allTodos.push(...sortedRecurringIncidentals, ...sortedIncidentals);

    // Sort all todos together
    const sortedAllTodos = sortTodos(allTodos, ruleset.sortBy);

    // Return as a single TodoGroup section
    return {
      allSections: [
        {
          title: "all todos",
          todos: sortedAllTodos,
        },
      ],
    };
  } else if (ruleset.groupBy === "world") {
    // Group by world, merging recurring and non-recurring
    const worldMap = new Map<World, { 
      topOfMindAndCategories: Section[];
      normal: Section[];
      later: Section[];
      incidentals: Todo[];
    }>();

    // Initialize worlds
    const worlds: World[] = ["life stuff", "music admin", "make music", "day job", "computer"];
    worlds.forEach((world) => {
      worldMap.set(world, { 
        topOfMindAndCategories: [],
        normal: [],
        later: [],
        incidentals: [] 
      });
    });

    // Merge recurring and non-recurring projects by documentId
    const mergedProjects = new Map<string, Project>();
    [...sortedRecurringProjects, ...sortedProjects].forEach((project) => {
      if ("documentId" in project) {
        const existing = mergedProjects.get(project.documentId);
        if (existing) {
          mergedProjects.set(project.documentId, {
            ...existing,
            todos: [...(existing.todos || []), ...(project.todos || [])],
          });
        } else {
          mergedProjects.set(project.documentId, { ...project });
        }
      }
    });

    // Merge recurring and non-recurring category groups by title
    const mergedCategoryGroups = new Map<string, TodoGroup>();
    [...sortedRecurringCategoryGroups, ...sortedCategoryGroups].forEach((group) => {
      const existing = mergedCategoryGroups.get(group.title);
      if (existing) {
        mergedCategoryGroups.set(group.title, {
          ...existing,
          todos: [...existing.todos, ...(group.todos || [])],
        });
      } else {
        mergedCategoryGroups.set(group.title, { 
          title: group.title,
          todos: group.todos || []
        });
      }
    });

    // Group merged projects and category groups by world and importance
    mergedProjects.forEach((project) => {
      const world = project.world || "life stuff";
      const worldData = worldMap.get(world);
      if (worldData) {
        const importance = project.importance || "normal";
        if (importance === "top of mind") {
          worldData.topOfMindAndCategories.push(project);
        } else if (importance === "later") {
          worldData.later.push(project);
        } else {
          worldData.normal.push(project);
        }
      }
    });

    // Group merged category groups by world (always go with top of mind)
    mergedCategoryGroups.forEach((group) => {
      if (group.todos && group.todos.length > 0) {
        const world = getTodoWorld(group.todos[0]);
        const worldData = worldMap.get(world);
        if (worldData) {
          worldData.topOfMindAndCategories.push(group);
        }
      }
    });

    // Process all incidentals (recurring and non-recurring) - add to topOfMindAndCategories
    const incidentalsByWorld = new Map<World, Todo[]>();
    [...sortedRecurringIncidentals, ...sortedIncidentals].forEach((todo) => {
      const world = getTodoWorld(todo);
      if (!incidentalsByWorld.has(world)) {
        incidentalsByWorld.set(world, []);
      }
      incidentalsByWorld.get(world)!.push(todo);
    });

    // Sort sections within each world, with special ordering for topOfMindAndCategories
    worldMap.forEach((worldData, world) => {
      // Sort top of mind and categories: top of mind projects first, then categories
      const topOfMindProjects: Section[] = [];
      const categoryGroups: Section[] = [];
      
      worldData.topOfMindAndCategories.forEach((section) => {
        if ("documentId" in section) {
          // It's a Project (should be top of mind since we filtered by importance)
          topOfMindProjects.push(section);
        } else {
          // It's a TodoGroup (category)
          categoryGroups.push(section);
        }
      });
      
      // Sort each group
      const sortedTopOfMind = sortSections(topOfMindProjects, ruleset.sortBy);
      const sortedCategories = sortSections(categoryGroups, ruleset.sortBy);
      
      // Combine: top of mind projects, then categories
      worldData.topOfMindAndCategories = [...sortedTopOfMind, ...sortedCategories];
      
      // Add incidentals (they'll be rendered with topOfMindAndCategories via the incidentals prop)
      const worldIncidentals = incidentalsByWorld.get(world) || [];
      worldData.incidentals = sortTodos(worldIncidentals, ruleset.sortBy);
      
      // Sort normal and later sections
      worldData.normal = sortSections(worldData.normal, ruleset.sortBy);
      worldData.later = sortSections(worldData.later, ruleset.sortBy);
    });

    return {
      worldSections: worldMap,
    };
  } else if (ruleset.groupBy === "project") {
    // Group by project - similar to merged but keep projects separate
    const allSections: Section[] = sortSections(
      [...sortedRecurringProjects, ...sortedProjects, ...sortedRecurringCategoryGroups, ...sortedCategoryGroups],
      ruleset.sortBy
    );
    const allIncidentals = sortTodos(
      [...sortedRecurringIncidentals, ...sortedIncidentals],
      ruleset.sortBy
    );

    return {
      allSections,
      incidentals: allIncidentals.length > 0 ? allIncidentals : undefined,
    };
  } else if (ruleset.groupBy === "category") {
    // Group by category - merge projects into category groups
    const categoryMap = new Map<TodoCategory | "incidentals", Todo[]>();

    // Collect all todos from projects and category groups
    [...sortedRecurringProjects, ...sortedProjects].forEach((project) => {
      if ("documentId" in project && project.todos) {
        project.todos.forEach((todo) => {
          if (todo.category) {
            if (!categoryMap.has(todo.category)) {
              categoryMap.set(todo.category, []);
            }
            categoryMap.get(todo.category)!.push(todo);
          } else {
            if (!categoryMap.has("incidentals")) {
              categoryMap.set("incidentals", []);
            }
            categoryMap.get("incidentals")!.push(todo);
          }
        });
      }
    });

    [...sortedRecurringCategoryGroups, ...sortedCategoryGroups].forEach((group) => {
      if (group.todos) {
        group.todos.forEach((todo) => {
          if (!categoryMap.has(group.title as TodoCategory)) {
            categoryMap.set(group.title as TodoCategory, []);
          }
          categoryMap.get(group.title as TodoCategory)!.push(todo);
        });
      }
    });

    // Add incidentals
    [...sortedRecurringIncidentals, ...sortedIncidentals].forEach((todo) => {
      if (!categoryMap.has("incidentals")) {
        categoryMap.set("incidentals", []);
      }
      categoryMap.get("incidentals")!.push(todo);
    });

    // Convert to TodoGroup sections with special sorting for "stuff" view
    if (ruleset.id === "stuff") {
      // For "stuff" view, split wishlist by wishListCategory and order sections
      const regularCategoryGroups: TodoGroup[] = [];
      const wishlistCategoryGroups: TodoGroup[] = [];
      
      Array.from(categoryMap.entries()).forEach(([category, todos]) => {
        if (category === "wishlist") {
          // Split wishlist items by wishListCategory (normalized)
          const wishlistCategoryMap = new Map<string, Todo[]>();
          
          todos.forEach((todo) => {
            // Normalize wishListCategory: lowercase and trim
            const normalizedCategory = todo.wishListCategory
              ? todo.wishListCategory.trim().toLowerCase()
              : "uncategorized";
            
            if (!wishlistCategoryMap.has(normalizedCategory)) {
              wishlistCategoryMap.set(normalizedCategory, []);
            }
            wishlistCategoryMap.get(normalizedCategory)!.push(todo);
          });
          
          // Create groups for each wishlist category
          wishlistCategoryMap.forEach((categoryTodos, normalizedCategory) => {
            // Sort by price: items without prices first, then items with prices (low to high)
            const sortedTodos = [...categoryTodos].sort((a, b) => {
              const priceA = a.price;
              const priceB = b.price;
              
              // If both have prices, sort by price (low to high)
              if (priceA !== null && priceB !== null) {
                return priceA - priceB;
              }
              
              // If one is null and one has a price, null comes first
              if (priceA === null && priceB !== null) {
                return -1;
              }
              if (priceA !== null && priceB === null) {
                return 1;
              }
              
              // Both are null, maintain order
              return 0;
            });
            
            // Use the original (non-normalized) category name from the first todo for display
            const displayName = categoryTodos[0]?.wishListCategory?.trim() || "uncategorized";
            
            wishlistCategoryGroups.push({
              title: displayName,
              todos: sortedTodos,
            });
          });
          
          // Sort wishlist category groups alphabetically
          wishlistCategoryGroups.sort((a, b) => a.title.localeCompare(b.title));
        } else {
          // Handle regular categories (buy stuff, in the mail, errands)
          let sortedTodos: Todo[];
          
          if (category === "buy stuff") {
            // Sort by creationDate (oldest first)
            sortedTodos = [...todos].sort((a, b) => {
              const dateA = new Date(a.createdAt).getTime();
              const dateB = new Date(b.createdAt).getTime();
              return dateA - dateB;
            });
          } else {
            // Use default sorting for other categories (e.g., "in the mail", "errands")
            sortedTodos = sortTodos(todos, ruleset.sortBy);
          }
          
          regularCategoryGroups.push({
            title: category === "incidentals" ? "incidentals" : category,
            todos: sortedTodos,
          });
        }
      });
      
      // Order: "buy stuff", "in the mail", "errands", then wishlist categories
      const orderedSections: TodoGroup[] = [];
      
      // Add "buy stuff" first if it exists
      const buyStuffGroup = regularCategoryGroups.find(g => g.title === "buy stuff");
      if (buyStuffGroup) {
        orderedSections.push(buyStuffGroup);
      }
      
      // Add "in the mail" second if it exists
      const inTheMailGroup = regularCategoryGroups.find(g => g.title === "in the mail");
      if (inTheMailGroup) {
        orderedSections.push(inTheMailGroup);
      }
      
      // Add "errands" third if it exists
      const errandsGroup = regularCategoryGroups.find(g => g.title === "errands");
      if (errandsGroup) {
        orderedSections.push(errandsGroup);
      }
      
      // Add all wishlist category groups
      orderedSections.push(...wishlistCategoryGroups);
      
      return {
        allSections: orderedSections,
      };
    } else {
      // For non-stuff views, use the original logic
    const categoryGroups: TodoGroup[] = Array.from(categoryMap.entries())
        .map(([category, todos]) => {
          const sortedTodos = sortTodos(todos, ruleset.sortBy);
          return {
        title: category === "incidentals" ? "incidentals" : category,
            todos: sortedTodos,
          };
        })
      .filter((group) => group.todos.length > 0);

    return {
      allSections: sortSections(categoryGroups, ruleset.sortBy),
    };
    }
  } else if (ruleset.groupBy === "good-morning") {
    // Track which todos have already been included to prevent duplicates
    const includedTodoIds = new Set<string>();

    // Find the "top of mind" project from original unfiltered data
    const topOfMindProject = [...data.projects, ...data.recurringProjects].find(
      (project) => "documentId" in project && project.importance === "top of mind"
    );
    const topOfMindProjectId = topOfMindProject && "documentId" in topOfMindProject ? topOfMindProject.documentId : null;

    // Helper to check if a section is the top of mind project
    const isTopOfMindSection = (section: Section): boolean => {
      return "documentId" in section && section.documentId === topOfMindProjectId;
    };

    // Helper to filter out "day job" world
    const filterDayJob = (todo: Todo): boolean => {
      const world = getTodoWorld(todo);
      return world !== "day job";
    };

    // Helper to filter and track todos from a section
    const filterSectionTodosForGoodMorning = (
      section: Section,
      todoFilter: (todo: Todo) => boolean
    ): Section | null => {
      const todos = "documentId" in section ? section.todos || [] : section.todos;
      // Filter todos that match the criteria and haven't been included yet
      const filteredTodos = todos.filter((todo) => 
        todoFilter(todo) && !includedTodoIds.has(todo.documentId)
      );

      // Track the included todos
      filteredTodos.forEach((todo) => includedTodoIds.add(todo.documentId));

      if (filteredTodos.length === 0) {
        return null;
      }

      if ("documentId" in section) {
        return {
          ...section,
          todos: filteredTodos,
        };
      } else {
        return {
          ...section,
          todos: filteredTodos,
        };
      }
    };

    // Helper to filter and track incidentals
    const filterAndTrackIncidentals = (
      todos: Todo[],
      todoFilter: (todo: Todo) => boolean
    ): Todo[] => {
      const filtered = todos.filter((todo) => 
        todoFilter(todo) && !includedTodoIds.has(todo.documentId)
      );
      // Track the included todos
      filtered.forEach((todo) => includedTodoIds.add(todo.documentId));
      return filtered;
    };

    // Helper to re-sort todos within a section by dueDate
    const reSortSectionTodosByDueDate = (section: Section): Section => {
      if ("documentId" in section) {
        return {
          ...section,
          todos: section.todos ? sortTodos(section.todos, "dueDate") : [],
        };
      } else {
        return {
          ...section,
          todos: sortTodos(section.todos, "dueDate"),
        };
      }
    };

    // Helper to merge sections, combining category groups with the same title
    const mergeSections = (sections: Section[], sortBy: LayoutRuleset["sortBy"] = "creationDate"): Section[] => {
      const projectMap = new Map<string, Project>();
      const categoryGroupMap = new Map<string, TodoGroup>();

      sections.forEach((section) => {
        if ("documentId" in section) {
          // It's a Project - keep separate by documentId
          const project = section as Project;
          projectMap.set(project.documentId, project);
        } else {
          // It's a TodoGroup - merge by title
          const group = section as TodoGroup;
          const existing = categoryGroupMap.get(group.title);
          if (existing) {
            // Merge todos from both groups and sort
            const mergedTodos = [...existing.todos, ...group.todos];
            categoryGroupMap.set(group.title, {
              ...group,
              todos: sortTodos(mergedTodos, sortBy),
            });
          } else {
            categoryGroupMap.set(group.title, group);
          }
        }
      });

      return [...Array.from(projectMap.values()), ...Array.from(categoryGroupMap.values())];
    };

    // Helper to merge sections, combining projects by documentId and category groups by title
    const mergeSectionsWithProjectMerging = (sections: Section[], sortBy: LayoutRuleset["sortBy"] = "creationDate"): Section[] => {
      const projectMap = new Map<string, Project>();
      const categoryGroupMap = new Map<string, TodoGroup>();

      sections.forEach((section) => {
        if ("documentId" in section) {
          // It's a Project - merge by documentId, combining todos
          const project = section as Project;
          const existing = projectMap.get(project.documentId);
          if (existing) {
            // Merge todos from both projects
            const mergedTodos = [...(existing.todos || []), ...(project.todos || [])];
            projectMap.set(project.documentId, {
              ...project,
              todos: mergedTodos,
            });
          } else {
            projectMap.set(project.documentId, project);
          }
        } else {
          // It's a TodoGroup - merge by title
          const group = section as TodoGroup;
          const existing = categoryGroupMap.get(group.title);
          if (existing) {
            // Merge todos from both groups and sort
            const mergedTodos = [...existing.todos, ...group.todos];
            categoryGroupMap.set(group.title, {
              ...group,
              todos: sortTodos(mergedTodos, sortBy),
            });
          } else {
            categoryGroupMap.set(group.title, group);
          }
        }
      });

      // Sort todos within each merged project: those with dueDate by dueDate, others by creationDate
      projectMap.forEach((project, documentId) => {
        if (project.todos) {
          const todosWithDueDate = project.todos.filter(t => t.dueDate);
          const todosWithoutDueDate = project.todos.filter(t => !t.dueDate);
          const sortedWithDueDate = sortTodos(todosWithDueDate, "dueDate");
          const sortedWithoutDueDate = sortTodos(todosWithoutDueDate, "creationDate");
          projectMap.set(documentId, {
            ...project,
            todos: [...sortedWithDueDate, ...sortedWithoutDueDate],
          });
        }
      });

      return [...Array.from(projectMap.values()), ...Array.from(categoryGroupMap.values())];
    };

    // 1. Combined Section: All todos with dueDate OR recurring todos without dueDate
    const combinedSections: Section[] = [];
    const combinedIncidentals: Todo[] = [];

    // Process recurring projects and category groups - todos with dueDate
    [...sortedRecurringProjects, ...sortedRecurringCategoryGroups].forEach((section) => {
      const filtered = filterSectionTodosForGoodMorning(section, (todo) => 
        (isTopOfMindSection(section) || filterDayJob(todo)) && !!todo.dueDate
      );
      if (filtered) {
        combinedSections.push(filtered);
      }
    });

    // Process recurring projects and category groups - recurring todos without dueDate
    [...sortedRecurringProjects, ...sortedRecurringCategoryGroups].forEach((section) => {
      const filtered = filterSectionTodosForGoodMorning(section, (todo) => 
        (isTopOfMindSection(section) || filterDayJob(todo)) && !todo.dueDate && todo.isRecurring
      );
      if (filtered) {
        combinedSections.push(filtered);
      }
    });

    // Process non-recurring projects and category groups - todos with dueDate
    [...sortedProjects, ...sortedCategoryGroups].forEach((section) => {
      const filtered = filterSectionTodosForGoodMorning(section, (todo) => 
        (isTopOfMindSection(section) || filterDayJob(todo)) && !!todo.dueDate
      );
      if (filtered) {
        combinedSections.push(filtered);
      }
    });

    // Process recurring incidentals - todos with dueDate
    const filteredRecurringIncidentalsDueDate = filterAndTrackIncidentals(
      sortedRecurringIncidentals,
      (todo) => filterDayJob(todo) && !!todo.dueDate
    );
    combinedIncidentals.push(...filteredRecurringIncidentalsDueDate);

    // Process recurring incidentals - recurring todos without dueDate
    const filteredRecurringIncidentals = filterAndTrackIncidentals(
      sortedRecurringIncidentals,
      (todo) => filterDayJob(todo) && !todo.dueDate && todo.isRecurring
    );
    combinedIncidentals.push(...filteredRecurringIncidentals);

    // Process non-recurring incidentals - todos with dueDate
    const filteredNonRecurringIncidentalsDueDate = filterAndTrackIncidentals(
      sortedIncidentals,
      (todo) => filterDayJob(todo) && !!todo.dueDate
    );
    combinedIncidentals.push(...filteredNonRecurringIncidentalsDueDate);

    // Process todos with soon=true - add them to combined sections and incidentals
    // Use ORIGINAL unfiltered data to get soon todos from ALL worlds (including day job)
    // We need to apply basic filtering (displayDate, recurring status) that would normally be applied
    
    // Recurring projects and category groups - todos with soon=true
    [...data.recurringProjects, ...data.recurringCategoryGroups].forEach((section) => {
      const todos = "documentId" in section ? section.todos || [] : section.todos;
      const filteredTodos = todos.filter((todo) => 
        todo.soon === true && 
        !includedTodoIds.has(todo.documentId)
      );
      
      filteredTodos.forEach((todo) => includedTodoIds.add(todo.documentId));
      
      if (filteredTodos.length > 0) {
        const sortedTodos = sortTodos(filteredTodos, ruleset.sortBy);
        if ("documentId" in section) {
          combinedSections.push({
            ...section,
            todos: sortedTodos,
          });
        } else {
          combinedSections.push({
            ...section,
            todos: sortedTodos,
          });
        }
      }
    });

    // Non-recurring projects and category groups - todos with soon=true
    [...data.projects, ...data.categoryGroups].forEach((section) => {
      const todos = "documentId" in section ? section.todos || [] : section.todos;
      const filteredTodos = todos.filter((todo) => {
        // Apply displayDate filtering for non-recurring todos
        if (todo.displayDate) {
          const today = getTodayInEST();
          const displayDate = parseInEST(todo.displayDate);
          if (displayDate > today) {
            return false;
          }
        }
        
        return todo.soon === true && 
          !includedTodoIds.has(todo.documentId);
      });
      
      filteredTodos.forEach((todo) => includedTodoIds.add(todo.documentId));
      
      if (filteredTodos.length > 0) {
        const sortedTodos = sortTodos(filteredTodos, ruleset.sortBy);
        if ("documentId" in section) {
          combinedSections.push({
            ...section,
            todos: sortedTodos,
          });
        } else {
          combinedSections.push({
            ...section,
            todos: sortedTodos,
          });
        }
      }
    });

    // Recurring incidentals - todos with soon=true
    const filteredRecurringIncidentalsSoon = data.recurringIncidentals.filter((todo) =>
      todo.soon === true && 
      !includedTodoIds.has(todo.documentId)
    );
    filteredRecurringIncidentalsSoon.forEach((todo) => includedTodoIds.add(todo.documentId));
    combinedIncidentals.push(...filteredRecurringIncidentalsSoon);

    // Non-recurring incidentals - todos with soon=true
    const filteredNonRecurringIncidentalsSoon = data.incidentals.filter((todo) => {
      // Apply displayDate filtering for non-recurring todos
      if (todo.displayDate) {
        const today = getTodayInEST();
        const displayDate = parseInEST(todo.displayDate);
        if (displayDate > today) {
          return false;
        }
      }
      
      return todo.soon === true && 
        !includedTodoIds.has(todo.documentId);
    });
    filteredNonRecurringIncidentalsSoon.forEach((todo) => includedTodoIds.add(todo.documentId));
    combinedIncidentals.push(...filteredNonRecurringIncidentalsSoon);

    // 2. Top of Mind Section: All non-recurring todos from the "top of mind" project
    const topOfMindSections: Section[] = [];
    const topOfMindIncidentals: Todo[] = [];

    if (topOfMindProjectId) {
      // Use ORIGINAL unfiltered data to get the top of mind project from ANY world (including day job)
      // Don't filter by world - top of mind projects always show up even if they're in "day job"
      data.projects.forEach((project) => {
        if ("documentId" in project && project.documentId === topOfMindProjectId) {
          const todos = project.todos || [];
          const filteredTodos = todos.filter((todo) => {
            // Apply displayDate filtering for non-recurring todos
            if (todo.displayDate) {
              const today = getTodayInEST();
              const displayDate = parseInEST(todo.displayDate);
              if (displayDate > today) {
                return false;
              }
            }
            
            return !todo.isRecurring && 
              !includedTodoIds.has(todo.documentId);
          });
          
          filteredTodos.forEach((todo) => includedTodoIds.add(todo.documentId));
          
          if (filteredTodos.length > 0) {
            const sortedTodos = sortTodos(filteredTodos, ruleset.sortBy);
            topOfMindSections.push({
              ...project,
              todos: sortedTodos,
            });
          }
        }
      });
    }

    // Re-sort todos within combined sections by dueDate (soonest first) for those with dueDate
    const reSortedCombinedSections = combinedSections.map(reSortSectionTodosByDueDate);

    // Merge sections to combine projects by documentId and category groups with the same title
    // This will merge projects that have both todos with dueDate and recurring todos without dueDate
    const mergedCombinedSections = mergeSectionsWithProjectMerging(reSortedCombinedSections, "dueDate");
    const mergedTopOfMindSections = mergeSections(topOfMindSections);

    // Sort all sections and incidentals
    // Combined sections: sort by dueDate (soonest first) for sections with todos that have dueDate
    const sortedCombinedSections = sortSections(mergedCombinedSections, "dueDate");
    const sortedCombinedIncidentals = sortTodos(combinedIncidentals, "dueDate");
    const sortedTopOfMindSections = sortSections(mergedTopOfMindSections, "creationDate");
    const sortedTopOfMindIncidentals = sortTodos(topOfMindIncidentals, "creationDate");

    return {
      combinedSections: sortedCombinedSections.length > 0 ? sortedCombinedSections : undefined,
      combinedIncidentals: sortedCombinedIncidentals.length > 0 ? sortedCombinedIncidentals : undefined,
      topOfMindSections: sortedTopOfMindSections.length > 0 ? sortedTopOfMindSections : undefined,
      topOfMindIncidentals: sortedTopOfMindIncidentals.length > 0 ? sortedTopOfMindIncidentals : undefined,
    };
  } else if (ruleset.groupBy === "chores") {
    // Helper to filter out "day job" world
    const filterDayJob = (todo: Todo): boolean => {
      const world = getTodoWorld(todo);
      return world !== "day job";
    };

    // Non-Recurring No Project Section: All non-recurring todos without projects (chores and incidentals)
    const nonRecurringNoProjectSections: Section[] = [];
    const nonRecurringNoProjectIncidentals: Todo[] = [];

    // Process non-recurring category groups (these don't have projects by definition)
    sortedCategoryGroups.forEach((group) => {
      const todos = group.todos || [];
      const filteredTodos = todos.filter((todo) => 
        filterDayJob(todo) && !todo.isRecurring && !todo.project
      );

      if (filteredTodos.length > 0) {
        nonRecurringNoProjectSections.push({
          ...group,
          todos: filteredTodos,
        });
      }
    });

    // Process non-recurring incidentals without projects
    const filteredNonRecurringNoProjectIncidentals = sortedIncidentals.filter(
      (todo) => filterDayJob(todo) && !todo.isRecurring && !todo.project
    );
    nonRecurringNoProjectIncidentals.push(...filteredNonRecurringNoProjectIncidentals);

    // Merge sections to combine category groups with the same title
    const mergeSections = (sections: Section[]): Section[] => {
      const categoryGroupMap = new Map<string, TodoGroup>();

      sections.forEach((section) => {
        if (!("documentId" in section)) {
          // It's a TodoGroup - merge by title
          const group = section as TodoGroup;
          const existing = categoryGroupMap.get(group.title);
          if (existing) {
            // Merge todos from both groups and sort
            const mergedTodos = [...existing.todos, ...group.todos];
            categoryGroupMap.set(group.title, {
              ...group,
              todos: sortTodos(mergedTodos, ruleset.sortBy),
            });
          } else {
            categoryGroupMap.set(group.title, group);
          }
        }
      });

      return [...Array.from(categoryGroupMap.values())];
    };

    const mergedNonRecurringNoProjectSections = mergeSections(nonRecurringNoProjectSections);

    // Sort all sections and incidentals
    const sortedNonRecurringNoProjectSections = sortSections(mergedNonRecurringNoProjectSections, ruleset.sortBy);
    const sortedNonRecurringNoProjectIncidentals = sortTodos(nonRecurringNoProjectIncidentals, ruleset.sortBy);

    return {
      nonRecurringNoProjectSections: sortedNonRecurringNoProjectSections.length > 0 ? sortedNonRecurringNoProjectSections : undefined,
      nonRecurringNoProjectIncidentals: sortedNonRecurringNoProjectIncidentals.length > 0 ? sortedNonRecurringNoProjectIncidentals : undefined,
    };
  } else if (ruleset.groupBy === "roulette") {
    // Collect all non-completed todos excluding "day job" world
    const allTodos: Todo[] = [];

    // Helper to filter out "day job" world
    const filterDayJob = (todo: Todo): boolean => {
      const world = getTodoWorld(todo);
      return world !== "day job";
    };

    // Collect todos from recurring projects
    sortedRecurringProjects.forEach((project) => {
      if ("documentId" in project && project.todos) {
        project.todos.forEach((todo) => {
          if (!todo.completed && filterDayJob(todo) && shouldIncludeTodo(todo, ruleset, getTodoWorld)) {
            allTodos.push(todo);
          }
        });
      }
    });

    // Collect todos from recurring category groups
    sortedRecurringCategoryGroups.forEach((group) => {
      if (group.todos) {
        group.todos.forEach((todo) => {
          if (!todo.completed && filterDayJob(todo) && shouldIncludeTodo(todo, ruleset, getTodoWorld)) {
            allTodos.push(todo);
          }
        });
      }
    });

    // Collect recurring incidentals
    sortedRecurringIncidentals.forEach((todo) => {
      if (!todo.completed && filterDayJob(todo) && shouldIncludeTodo(todo, ruleset, getTodoWorld)) {
        allTodos.push(todo);
      }
    });

    // Collect todos from non-recurring projects
    sortedProjects.forEach((project) => {
      if ("documentId" in project && project.todos) {
        project.todos.forEach((todo) => {
          if (!todo.completed && filterDayJob(todo) && shouldIncludeTodo(todo, ruleset, getTodoWorld)) {
            allTodos.push(todo);
          }
        });
      }
    });

    // Collect todos from non-recurring category groups
    sortedCategoryGroups.forEach((group) => {
      if (group.todos) {
        group.todos.forEach((todo) => {
          if (!todo.completed && filterDayJob(todo) && shouldIncludeTodo(todo, ruleset, getTodoWorld)) {
            allTodos.push(todo);
          }
        });
      }
    });

    // Collect non-recurring incidentals
    sortedIncidentals.forEach((todo) => {
      if (!todo.completed && filterDayJob(todo) && shouldIncludeTodo(todo, ruleset, getTodoWorld)) {
        allTodos.push(todo);
      }
    });

    return {
      rouletteTodos: allTodos,
    };
  } else if (ruleset.groupBy === "later") {
    // Filter projects by importance === "later" (both recurring and non-recurring)
    // Note: filteredRecurringProjects and filteredProjects already respect displayDate via filterSectionTodos
    const laterRecurringProjects = filteredRecurringProjects.filter((project) => {
      if ("documentId" in project) {
        return project.importance === "later";
      }
      return false;
    });

    const laterProjects = filteredProjects.filter((project) => {
      if ("documentId" in project) {
        return project.importance === "later";
      }
      return false;
    });

    // Merge recurring and non-recurring projects by documentId
    const mergedLaterProjects = new Map<string, Project>();

    [...laterRecurringProjects, ...laterProjects].forEach((project) => {
      if ("documentId" in project) {
        const existing = mergedLaterProjects.get(project.documentId);
        if (existing) {
          mergedLaterProjects.set(project.documentId, {
            ...existing,
            todos: [...(existing.todos || []), ...(project.todos || [])],
          });
        } else {
          mergedLaterProjects.set(project.documentId, { ...project });
        }
      }
    });

    // Sort todos within each project
    const sortedLaterProjects = Array.from(mergedLaterProjects.values()).map((project) => {
      return {
        ...project,
        todos: project.todos ? sortTodos(project.todos, ruleset.sortBy) : [],
      };
    });

    // Sort projects
    const allSections: Section[] = sortSections(sortedLaterProjects, ruleset.sortBy);

    return {
      allSections,
    };
  } else if (ruleset.groupBy === "done") {
    // Collect all completed todos, excluding "in the mail" and "errands" categories
    const completedTodos = (data.completedTodos || []).filter((todo) => 
      todo.category !== "in the mail" && todo.category !== "errands"
    );

    // Group todos by completion date (day)
    const todosByDate = new Map<string, Todo[]>();

    completedTodos.forEach((todo) => {
      if (todo.completedAt) {
        // Parse the completedAt timestamp in configured timezone
        const completedDate = toZonedTime(new Date(todo.completedAt), getTimezone());
        
        // Get the hour in EST (0-23)
        const hour = completedDate.getHours();
        
        // If before 4am, group with previous day
        let adjustedDate = new Date(completedDate);
        if (hour < 4) {
          adjustedDate.setDate(adjustedDate.getDate() - 1);
        }
        
        const dateKey = toISODateInEST(adjustedDate);
        
        if (!todosByDate.has(dateKey)) {
          todosByDate.set(dateKey, []);
        }
        todosByDate.get(dateKey)!.push(todo);
      }
    });

    // Add "worked on" entries for long todos with work sessions
    // Use the dedicated longTodosWithSessions array passed from the API
    const longTodos = data.longTodosWithSessions || [];

    longTodos.forEach((todo) => {
      if (todo.workSessions && todo.workSessions.length > 0) {
        todo.workSessions.forEach((session) => {
          // Create a virtual "worked on" entry for each work session
          const workedOnEntry: Todo = {
            ...todo,
            id: -1, // Use negative ID to indicate this is a virtual entry
            documentId: `${todo.documentId}-worked-${session.date}`,
            title: `worked on ${todo.title}`,
            completed: false, // Mark as not completed to differentiate from actual completions
            completedAt: session.timestamp, // Use the actual timestamp from the work session
          };

          if (!todosByDate.has(session.date)) {
            todosByDate.set(session.date, []);
          }
          todosByDate.get(session.date)!.push(workedOnEntry);
        });
      }
    });

    // Calculate the cutoff date (30 days ago from today)
    const nowInEST = toZonedTime(new Date(), getTimezone());
    const hour = nowInEST.getHours();
    let todayDate = new Date(getTodayInEST());
    if (hour < 4) {
      // If before 4am, "today" is actually yesterday's date
      todayDate.setDate(todayDate.getDate() - 1);
    }
    
    const thirtyDaysAgo = new Date(todayDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // 29 days ago + today = 30 days total
    const cutoffDateISO = toISODateInEST(thirtyDaysAgo);

    // Create sections for each date, sorted by date descending (most recent first)
    // Filter to only include dates within the last 30 days
    const dateSections: TodoGroup[] = Array.from(todosByDate.entries())
      .filter(([dateKey]) => {
        // Only include dates that are >= 30 days ago
        return dateKey >= cutoffDateISO;
      })
      .sort(([dateA], [dateB]) => {
        // Sort dates descending (most recent first)
        return dateB.localeCompare(dateA);
      })
      .map(([dateKey, todos]) => {
        // Format the date for display
        const date = parseInEST(dateKey);
        
        const yesterdayDate = new Date(todayDate);
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        
        let dateTitle: string;
        const dateISO = toISODateInEST(date);
        const todayISO = toISODateInEST(todayDate);
        const yesterdayISO = toISODateInEST(yesterdayDate);
        
        if (dateISO === todayISO) {
          dateTitle = "today";
        } else if (dateISO === yesterdayISO) {
          dateTitle = "yesterday";
        } else {
          // Format as "wed dec 1" or similar (abbreviated weekday and month)
          dateTitle = formatInEST(date, "EEE MM/d").toLowerCase();
        }

        // Sort todos within this day by completedAt ascending (earliest first)
        const sortedTodos = todos.sort((a, b) => {
          const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          // Put todos without completedAt at the end
          if (!a.completedAt && !b.completedAt) return 0;
          if (!a.completedAt) return 1;
          if (!b.completedAt) return -1;
          // Sort ascending (earliest first)
          return dateA - dateB;
        });

        return {
          title: dateTitle,
          todos: sortedTodos,
        };
      });

    // Process upcoming todos and group by day
    const upcomingTodos = data.upcomingTodos || [];
    const upcomingByDate = new Map<string, Todo[]>();

    upcomingTodos.forEach((todo) => {
      if (todo.displayDate) {
        const dateKey = todo.displayDate; // Already in YYYY-MM-DD format
        
        if (!upcomingByDate.has(dateKey)) {
          upcomingByDate.set(dateKey, []);
        }
        upcomingByDate.get(dateKey)!.push(todo);
      }
    });

    // Calculate tomorrow through 4 days out
    // Use actual today (not adjusted by 4am cutoff) for upcoming todos
    const actualToday = getTodayInEST();

    // Create sections for the next 4 days
    const upcomingDaySections: TodoGroup[] = [];
    for (let i = 0; i < 4; i++) {
      // Use addDays to properly handle date arithmetic
      const currentDate = addDays(actualToday, i + 1);
      const dateKey = toISODateInEST(currentDate);
      const todos = upcomingByDate.get(dateKey) || [];

      // Format the date for display
      let dateTitle: string;
      if (i === 0) {
        dateTitle = "tomorrow";
      } else {
        // Format as day name (e.g., "wednesday", "thursday")
        dateTitle = formatInEST(currentDate, "EEEE").toLowerCase();
      }

      upcomingDaySections.push({
        title: dateTitle,
        todos: todos,
      });
    }

    return {
      allSections: dateSections,
      upcomingTodosByDay: upcomingDaySections,
    };
  }

  // Fallback
  return {};
}

