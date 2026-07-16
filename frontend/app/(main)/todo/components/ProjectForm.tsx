"use client";

import { useForm, SubmitHandler, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import type { Project, ProjectImportance, StrapiBlock } from "@/app/types/index";
import RichTextEditor from "@/app/components/RichTextEditor";
import { slugify } from "@/app/lib/slugify";
import { useWorlds } from "@/app/hooks/useWorlds";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.array(z.any()).optional(),
  world: z.string().optional(), // a world documentId ("" = no world)
  importance: z.enum(["normal", "top of mind", "later"]),
  // `default`, not `normal` — that is importance's ordinary value. These must
  // match the Strapi enum or the save 400s.
  projectType: z.enum([
    "default",
    "chores",
    "wishlist",
    "errands",
    "in the mail",
    "buy stuff",
  ]),
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
      // Most existing rows store null rather than 'default'; both mean ordinary.
      projectType: project?.projectType || "default",
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
      projectType: data.projectType,
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
        <label htmlFor="projectType">type</label>
        <select id="projectType" {...register("projectType")}>
          <option value="default">default</option>
          <option value="chores">chores</option>
          <option value="wishlist">wishlist</option>
          <option value="errands">errands</option>
          <option value="in the mail">in the mail</option>
          <option value="buy stuff">buy stuff</option>
        </select>
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
