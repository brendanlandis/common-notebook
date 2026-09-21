"use client";

import TaskViewContent from "./TaskViewContent";
import { getDefaultViewSlug } from "@/app/lib/views";
import { useStuffProjects } from "@/app/contexts/StuffProjectsContext";
import { useViews } from "@/app/hooks/useViews";

// Home renders the default view — the first view in the user's ordering.
// Every other view lives at /todo/view/<slug>.
export default function DefaultView() {
  const { stuffProjectsEnabled } = useStuffProjects();
  const { views, loading } = useViews();

  if (loading) {
    return (
      <div id="container-task" className="text-center" suppressHydrationWarning>
        <p>loading...</p>
      </div>
    );
  }

  const slug = getDefaultViewSlug(views, stuffProjectsEnabled);
  return <TaskViewContent slug={slug} />;
}
