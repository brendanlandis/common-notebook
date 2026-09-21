"use client";

import { useForm, SubmitHandler, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import type { Project, StrapiBlock } from "@/app/types/index";
import { Checkbox, Field, Input, Select } from "@/app/components/ui/FormControls";
import RichTextEditor from "@/app/components/ui/RichTextEditor";
import { slugify } from "@/app/lib/slugify";
import { useWorlds } from "@/app/(main)/(todo)/hooks/useWorlds";
import { isPracticeWorld } from "@/app/lib/worlds";
import Button from "@/app/components/ui/Button";

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
  // What kind of subject this is, when it lives in practice and study. Held
  // separately from `chores` because they are different axes that happen to
  // share one Strapi column: a subject is never a chores project, and the form
  // shows one or the other, never both.
  subjectType: z.enum(["instrument", "study"]),
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
      // Instrument by default — most subjects are something you pick up and
      // play, and a study subject is the deliberate choice.
      subjectType: project?.projectType === "study" ? "study" : "instrument",
    },
  });

  // The slug is read-only and derived from the title (the server re-slugifies
  // and enforces per-owner uniqueness, so this is a preview).
  const titleValue = useWatch({ control, name: "title" });
  const slugPreview = slugify(titleValue || "");

  // Whether this project is a practice *subject*, which is decided by the world
  // it is being filed under — watched rather than read once, so choosing the
  // world reveals the subject type in the same interaction rather than after a
  // save and a reopen.
  const selectedWorld = useWatch({ control, name: "world" });
  const isSubject = isPracticeWorld(
    worlds.find((w) => w.documentId === selectedWorld)
  );

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
      // One column, three sources. A subject in practice and study is an
      // instrument or a study; anywhere else it is chores or ordinary. The
      // stuff types are set elsewhere and never touched here.
      projectType: isSubject
        ? data.subjectType
        : data.chores
          ? "chores"
          : "default",
    };

    onSubmit(payload);
  };

  return (
    <form
      className="flex flex-col gap-fields text-left"
      onSubmit={handleSubmit(handleFormSubmit)}
    >
      <Field label="title" htmlFor="title" hideLabel error={errors.title?.message}>
        <Input
          id="title"
          placeholder="name of project"
          type="text"
          {...register("title")}
        />
      </Field>

      <Field label="slug" htmlFor="slug" hideLabel>
        <Input id="slug" type="text" value={slugPreview} readOnly tabIndex={-1} />
      </Field>

      <Field label="description" htmlFor="description" hideLabel>
        <RichTextEditor value={description} onChange={setDescription} />
      </Field>

      <Field label="world" htmlFor="world" hideLabel>
        <Select id="world" {...register("world")}>
          <option value="">no world</option>
          {worlds.map((w) => (
            <option key={w.documentId} value={w.documentId}>
              {w.title}
            </option>
          ))}
        </Select>
      </Field>

      {/* Subject type, only for practice and study. Appears as soon as the
          world is chosen, since the two questions are really one: filing a
          project there is what makes "instrument or study?" worth asking. */}
      {isSubject && (
        <Field label="kind of subject" htmlFor="subjectType" hideLabel>
          <Select id="subjectType" {...register("subjectType")}>
            <option value="instrument">instrument</option>
            <option value="study">study</option>
          </Select>
        </Field>
      )}

      {/* Hidden for a subject: chores and subject type are the same Strapi
          column, and a subject is never a chores project. Offering both would
          let you tick a box that the save then silently discards. */}
      {!isSubject && (
        <Checkbox id="chores" {...register("chores")}>
          chores
        </Checkbox>
      )}

      <Field label="importance" htmlFor="importance" hideLabel>
        <Select id="importance" {...register("importance")}>
          <option value="normal">normal</option>
          <option value="top of mind">top of mind</option>
          <option value="later">later</option>
        </Select>
      </Field>

      <div className="text-center">
        <Button type="submit">
          {project ? "update" : "create"} project
        </Button>
      </div>
    </form>
  );
}
