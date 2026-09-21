"use client";

import TaskViewContent from "./components/TaskViewContent";
import { getDefaultViewSlug } from "@/app/lib/views";
import { useStuffProjects } from "@/app/(main)/(todo)/contexts/StuffProjectsContext";
import { useViews } from "@/app/(main)/(todo)/hooks/useViews";

// Home renders the default view — the first view in the user's ordering.
// Every other view lives at /view/<slug>.
export default function HomePage() {
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
