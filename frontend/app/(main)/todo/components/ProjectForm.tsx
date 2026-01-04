"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import type { Project, World, ProjectImportance, StrapiBlock } from "@/app/types/admin";
import RichTextEditor from "@/app/components/admin/RichTextEditor";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.array(z.any()).optional(),
  world: z
    .enum(["life stuff", "music admin", "make music", "day job", "computer"])
    .optional(),
  importance: z.enum(["normal", "top of mind", "later"]),
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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectFormInputs>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: project?.title || "",
      description: project?.description || [],
      world: project?.world || undefined,
      importance: project?.importance || "normal",
    },
  });

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
      description: filteredDescription,
      world: data.world,
      importance: data.importance,
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
        <label htmlFor="description">description</label>
        <RichTextEditor value={description} onChange={setDescription} />
      </div>

      <div>
        <label htmlFor="world">world</label>
        <select id="world" {...register("world")}>
          <option value="">no world</option>
          <option value="life stuff">life stuff</option>
          <option value="music admin">music admin</option>
          <option value="make music">make music</option>
          <option value="day job">day job</option>
          <option value="computer">computer</option>
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
