import { toISODateInEST, getTodayInEST, parseInEST } from './dateUtils';

const STRAPI_API_URL = process.env.STRAPI_API_URL;

/**
 * Perform the moon phase reset: set soon=false on todos and importance='normal' on projects
 * @param token - Authentication token for Strapi API
 * @returns Object with counts of updated todos and projects
 */
export async function performMoonPhaseReset(token: string): Promise<{
  todosUpdated: number;
  projectsUpdated: number;
}> {
  let todosUpdated = 0;
  let projectsUpdated = 0;

  // Fetch all todos where soon is true
  let allTodos: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `${STRAPI_API_URL}/api/todos?filters[soon][$eq]=true&pagination[pageSize]=100&pagination[page]=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch todos');
    }

    const data = await response.json();
    allTodos = allTodos.concat(data.data);

    // Check if there are more pages
    const pagination = data.meta?.pagination;
    if (pagination && page < pagination.pageCount) {
      page++;
    } else {
      hasMore = false;
    }
  }

  // Update each todo to set soon to false
  for (const todo of allTodos) {
    const documentId = todo.documentId || todo.id;
    const updateResponse = await fetch(
      `${STRAPI_API_URL}/api/todos/${documentId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: {
            soon: false,
          },
        }),
      }
    );

    if (updateResponse.ok) {
      todosUpdated++;
    } else {
      console.error(`Failed to update todo ${documentId}:`, await updateResponse.text());
    }
  }

  // Fetch all projects
  const projectsResponse = await fetch(`${STRAPI_API_URL}/api/projects`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!projectsResponse.ok) {
    throw new Error('Failed to fetch projects');
  }

  const projectsData = await projectsResponse.json();
  const projects = projectsData.data || [];

  // Filter and update projects with importance 'top of mind'
  for (const project of projects) {
    const importance = project.attributes?.importance || project.importance;
    if (importance === 'top of mind') {
      const documentId = project.documentId || project.id;
      const updateResponse = await fetch(
        `${STRAPI_API_URL}/api/projects/${documentId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            data: {
              importance: 'normal',
            },
          }),
        }
      );

      if (updateResponse.ok) {
        projectsUpdated++;
      } else {
        console.error(`Failed to update project ${documentId}:`, await updateResponse.text());
      }
    }
  }

  return { todosUpdated, projectsUpdated };
}

/**
 * Update the moon phase last reset date in system settings
 * @param token - Authentication token for Strapi API
 */
export async function updateMoonPhaseResetDate(token: string): Promise<void> {
  try {
    const resetDate = toISODateInEST(getTodayInEST());

    // First, check if an entry with this title exists
    const getResponse = await fetch(
      `${STRAPI_API_URL}/api/system-settings?filters[title][$eq]=moonPhaseLastResetDate`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!getResponse.ok) {
      console.error('Failed to check existing system setting:', await getResponse.text());
      return;
    }

    const getData = await getResponse.json();
    const existingSettings = getData.data || [];

    if (existingSettings.length > 0) {
      // Update existing entry
      const existingSetting = existingSettings[0];
      const documentId = existingSetting.documentId || existingSetting.id;

      const updateResponse = await fetch(
        `${STRAPI_API_URL}/api/system-settings/${documentId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            data: {
              title: 'moonPhaseLastResetDate',
              date: resetDate,
            },
          }),
        }
      );

      if (!updateResponse.ok) {
        console.error('Failed to update moon phase reset date:', await updateResponse.text());
      }
    } else {
      // Create new entry
      const createResponse = await fetch(`${STRAPI_API_URL}/api/system-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: {
            title: 'moonPhaseLastResetDate',
            date: resetDate,
          },
        }),
      });

      if (!createResponse.ok) {
        console.error('Failed to create moon phase reset date:', await createResponse.text());
      }
    }
  } catch (error) {
    console.error('Error updating moon phase reset date:', error);
  }
}

