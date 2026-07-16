"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import TaskViewContent from "../../components/TaskViewContent";
import {
  getDefaultViewSlug,
  findViewBySlug,
  findCodePreset,
} from "@/app/lib/views";
import { useStuffProjects } from "@/app/contexts/StuffProjectsContext";
import { useViews } from "@/app/hooks/useViews";

// Per-view route. The default view canonicalizes to bare /todo, so its own path
// (and any unknown/unavailable slug) forwards there.
export default function ViewPage() {
  const params = useParams<{ view: string }>();
  const slug = decodeURIComponent(params.view);
  const router = useRouter();
  const { stuffProjectsEnabled } = useStuffProjects();
  const { views, loading } = useViews();

  const defaultSlug = getDefaultViewSlug(views, stuffProjectsEnabled);
  let view = findViewBySlug(slug, views);
  if (view?.systemKey === "stuff" && !stuffProjectsEnabled) view = undefined;
  const isAvailable = Boolean(findCodePreset(slug)) || Boolean(view);
  const shouldRedirect = !loading && (slug === defaultSlug || !isAvailable);

  useEffect(() => {
    if (shouldRedirect) router.replace("/todo");
  }, [shouldRedirect, router]);

  if (loading || shouldRedirect) {
    return (
      <div id="container-task" suppressHydrationWarning>
        <p>loading...</p>
      </div>
    );
  }

  return <TaskViewContent slug={slug} />;
}
