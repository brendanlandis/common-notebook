"use client";

import { useForm, SubmitHandler, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import type { Project, StrapiBlock } from "@/app/types/index";
import RichTextEditor from "@/app/components/RichTextEditor";
import { slugify } from "@/app/lib/slugify";
import { useWorlds } from "@/app/hooks/useWorlds";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.array(z.any()).optional(),
  world: z.string().optional(), // a world documentId ("" = no world)
  importance: z.enum(["normal", "top of mind", "later"]),
  // The form exposes only ordinary vs chores as a checkbox. The other Strapi
  // projectType values (wishlist / errands / in the mail / buy stuff) belong
  // exclusively to "stuff"-world projects and are managed elsewhere, so they are
  // hidden here. On submit, chores → "chores", otherwise → "default".
  chores: z.boolean(),
});

type ProjectFormInputs = z.infer<typeof schema>;

interface ProjectFormProps {
  project?: Project;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export default function ProjectForm({
  project,
  onSubmit,
  onCancel,
}: ProjectFormProps) {
  const [description, setDescription] = useState<StrapiBlock[]>(
    project?.description || []
  );
  const { worlds } = useWorlds();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ProjectFormInputs>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: project?.title || "",
      description: project?.description || [],
      world: project?.world?.documentId ?? "",
      importance: project?.importance || "normal",
      // Both null and 'default' mean ordinary; only 'chores' checks the box.
      chores: project?.projectType === "chores",
    },
  });

  // The slug is read-only and derived from the title (the server re-slugifies
  // and enforces per-owner uniqueness, so this is a preview).
  const titleValue = useWatch({ control, name: "title" });
  const slugPreview = slugify(titleValue || "");

  const handleFormSubmit: SubmitHandler<ProjectFormInputs> = (data) => {
    // Helper to check if block is empty
    const isEmptyBlock = (block: StrapiBlock) => {
      if (block.type === 'paragraph') {
        if (!block.children || block.children.length === 0) return true;
        return block.children.every(child => 
          child.type === 'text' && (!child.text || child.text.trim() === '')
        );
      }
      return false;
    };
    
    // Filter out all empty blocks from description
    const filteredDescription = description.filter(block => !isEmptyBlock(block));
    
    const payload = {
      title: data.title,
      slug: slugify(data.title),
      description: filteredDescription,
      world: data.world,
      importance: data.importance,
      projectType: data.chores ? "chores" : "default",
    };

    onSubmit(payload);
  };

  return (
    <form className="project-form" onSubmit={handleSubmit(handleFormSubmit)}>
      <h2>{project ? "edit project" : "new project"}</h2>

      <div>
        <label htmlFor="title">title</label>
        <input
          id="title"
          placeholder="name of project"
          type="text"
          {...register("title")}
        />
        {errors.title && <span className="error">{errors.title.message}</span>}
      </div>

      <div>
        <label htmlFor="slug">slug</label>
        <input
          id="slug"
          type="text"
          value={slugPreview}
          readOnly
          tabIndex={-1}
        />
      </div>

      <div>
        <label htmlFor="description">description</label>
        <RichTextEditor value={description} onChange={setDescription} />
      </div>

      <div>
        <label htmlFor="world">world</label>
        <select id="world" {...register("world")}>
          <option value="">no world</option>
          {worlds.map((w) => (
            <option key={w.documentId} value={w.documentId}>
              {w.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="settings-checkbox" htmlFor="chores">
          <input id="chores" type="checkbox" {...register("chores")} />
          chores
        </label>
      </div>

      <div>
        <label htmlFor="importance">importance</label>
        <select id="importance" {...register("importance")}>
          <option value="normal">normal</option>
          <option value="top of mind">top of mind</option>
          <option value="later">later</option>
        </select>
      </div>

      <div className="form-actions">
        <button className="btn" type="submit">
          {project ? "update" : "create"} project
        </button>
      </div>
    </form>
  );
}
