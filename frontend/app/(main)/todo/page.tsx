"use client";

import TaskViewContent from "./components/TaskViewContent";
import { getDefaultViewSlug } from "@/app/lib/views";
import { useStuffProjects } from "@/app/contexts/StuffProjectsContext";
import { useViews } from "@/app/contexts/ViewsContext";

// Bare /todo renders the default view — the first view in the user's ordering.
// Every other view lives at /todo/view/<slug>.
export default function TaskPage() {
  const { stuffProjectsEnabled } = useStuffProjects();
  const { views, loading } = useViews();

  if (loading) {
    return (
      <div id="container-task" suppressHydrationWarning>
        <p>loading...</p>
      </div>
    );
  }

  const slug = getDefaultViewSlug(views, stuffProjectsEnabled);
  return <TaskViewContent slug={slug} />;
}
