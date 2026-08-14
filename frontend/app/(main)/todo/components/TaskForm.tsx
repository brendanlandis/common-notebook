"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect, useMemo } from "react";
import ProjectSelector from "./ProjectSelector";
import type {
  Task,
  RecurrenceType,
  RecurrenceRule,
  RecurrenceAnchor,
  ProjectType,
  StrapiBlock,
} from "@/app/types/index";
import { getTaskProjectType } from "@/app/lib/taskProjectType";
import { calculateNextRecurrence, hasEventDate } from "@/app/lib/recurrence";
import RecurrencePicker from "@/app/components/RecurrencePicker";
import { useDateTimeSettings } from "@/app/contexts/DateTimeSettingsContext";
import { useTasks } from "../hooks/useTasks";
import RichTextEditor from "@/app/components/RichTextEditor";
import {
  showTrackingUrl,
  showPurchaseUrl,
  showPriceAndWishlistCategory,
  showRecurringCheckbox,
  showSoonCheckbox,
  showLongCheckbox,
  showDateFields,
  allowsRecurring,
} from "../utils/formFieldVisibility";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.array(z.any()).optional(),
  dueDate: z.string().nullable().optional(),
  displayDate: z.string().nullable().optional(),
  displayDateOffset: z.number().nullable().optional(),
  isRecurring: z.boolean(),
  recurrenceType: z.string().optional(),
  recurrenceInterval: z.number().nullable().optional(),
  recurrenceDayOfWeek: z.number().nullable().optional(),
  recurrenceDayOfMonth: z.number().nullable().optional(),
  recurrenceWeekOfMonth: z.number().nullable().optional(),
  recurrenceDayOfWeekMonthly: z.number().nullable().optional(),
  recurrenceMonth: z.number().nullable().optional(),
  projectDocumentId: z.string().nullable().optional(),
  trackingUrl: z.string().nullable().optional(),
  purchaseUrl: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  wishListCategory: z.string().nullable().optional(),
  soon: z.boolean(),
  long: z.boolean(),
}).superRefine((data, ctx) => {
  // Validate recurrence fields based on recurrence type
  if (data.isRecurring && data.recurrenceType) {
    if (data.recurrenceType === 'every x days' && !data.recurrenceInterval) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Interval is required for 'every x days' recurrence",
        path: ['recurrenceInterval'],
      });
    }
    if ((data.recurrenceType === 'weekly' || data.recurrenceType === 'biweekly') && !data.recurrenceDayOfWeek) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Day of week is required for weekly/biweekly recurrence",
        path: ['recurrenceDayOfWeek'],
      });
    }
    if (data.recurrenceType === 'monthly date' && !data.recurrenceDayOfMonth) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Day of month is required for monthly date recurrence",
        path: ['recurrenceDayOfMonth'],
      });
    }
    if (data.recurrenceType === 'monthly day' && (!data.recurrenceWeekOfMonth || !data.recurrenceDayOfWeekMonthly)) {
      if (!data.recurrenceWeekOfMonth) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Week of month is required for monthly day recurrence",
          path: ['recurrenceWeekOfMonth'],
        });
      }
      if (!data.recurrenceDayOfWeekMonthly) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Day of week is required for monthly day recurrence",
          path: ['recurrenceDayOfWeekMonthly'],
        });
      }
    }
    if (data.recurrenceType === 'annually' && (!data.recurrenceMonth || !data.recurrenceDayOfMonth)) {
      if (!data.recurrenceMonth) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Month is required for annual recurrence",
          path: ['recurrenceMonth'],
        });
      }
      if (!data.recurrenceDayOfMonth) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Day of month is required for annual recurrence",
          path: ['recurrenceDayOfMonth'],
        });
      }
    }
  }
});

type TaskFormInputs = z.infer<typeof schema>;

interface TaskFormProps {
  task?: Task;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export default function TaskForm({ task, onSubmit, onCancel }: TaskFormProps) {
  const { timeZoneSettings } = useDateTimeSettings();
  // Straight from the query rather than through TaskDataContext: this form only
  // needs the task list, and pulling the whole context re-rendered it on every
  // unrelated change. The cache is shared, so this costs no extra request.
  const { tasks } = useTasks();
  const [description, setDescription] = useState<StrapiBlock[]>(
    task?.description || []
  );

  const [wishListCategoryInput, setWishListCategoryInput] = useState<string>(
    task?.wishListCategory || ""
  );
  const [showWishListCategorySuggestions, setShowWishListCategorySuggestions] =
    useState(false);

  // The selected project's type drives which shopping-list fields appear.
  // Derived from the selected project (reported by ProjectSelector) rather than
  // stored on the task.
  const [selectedProjectType, setSelectedProjectType] =
    useState<ProjectType | null>(task ? getTaskProjectType(task) : null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TaskFormInputs>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || [],
      dueDate: task?.dueDate || "",
      displayDate: task?.displayDate || null,
      displayDateOffset: task?.displayDateOffset ?? 0,
      isRecurring: task?.isRecurring || false,
      recurrenceType: task?.recurrenceType || "none",
      recurrenceInterval: task?.recurrenceInterval || null,
      recurrenceDayOfWeek: task?.recurrenceDayOfWeek ?? 1,
      recurrenceDayOfMonth: task?.recurrenceDayOfMonth ?? 1,
      recurrenceWeekOfMonth: task?.recurrenceWeekOfMonth ?? 1,
      recurrenceDayOfWeekMonthly: task?.recurrenceDayOfWeekMonthly ?? 1,
      recurrenceMonth: task?.recurrenceMonth ?? 1,
      projectDocumentId: (task?.project as any)?.documentId || null,
      trackingUrl: task?.trackingUrl || null,
      purchaseUrl: task?.purchaseUrl || null,
      price: task?.price || null,
      wishListCategory: task?.wishListCategory || null,
      soon: task?.soon || false,
      long: task?.long || false,
    },
  });

  // Single source of truth: react-hook-form. Watch the fields the UI conditions on.
  const selectedProject = watch("projectDocumentId");
  const isRecurring = watch("isRecurring");
  const unifiedValue = selectedProject || null;

  // The recurrence pattern, assembled from form state for the controlled picker.
  // Watched rather than held in local state so there is exactly one copy: the
  // form's. The picker writes back through `setValue`, which re-renders this.
  const recurrenceRule: RecurrenceRule = {
    isRecurring: isRecurring ?? false,
    recurrenceType: (watch("recurrenceType") as RecurrenceType) ?? "none",
    recurrenceInterval: watch("recurrenceInterval") ?? null,
    recurrenceDayOfWeek: watch("recurrenceDayOfWeek") ?? null,
    recurrenceDayOfMonth: watch("recurrenceDayOfMonth") ?? null,
    recurrenceWeekOfMonth: watch("recurrenceWeekOfMonth") ?? null,
    recurrenceDayOfWeekMonthly: watch("recurrenceDayOfWeekMonthly") ?? null,
    recurrenceMonth: watch("recurrenceMonth") ?? null,
  };
  const watchedOffset = watch("displayDateOffset");

  // Wishlist category suggestions, derived from the tasks already in context.
  // This form remounts on every drawer open, so fetching /api/tasks here meant a
  // full task list over the wire each time to build a handful of strings.
  const wishListCategorySuggestions = useMemo(() => {
    if (selectedProjectType !== "wishlist") return [];
    const categories = new Set<string>();
    tasks.forEach((task) => {
      if (getTaskProjectType(task) === "wishlist" && task.wishListCategory) {
        categories.add(task.wishListCategory.trim());
      }
    });
    return Array.from(categories).sort();
  }, [selectedProjectType, tasks]);

  // Filter suggestions based on input
  const filteredWishListCategorySuggestions = wishListCategoryInput
    ? wishListCategorySuggestions.filter((suggestion) =>
        suggestion.toLowerCase().includes(wishListCategoryInput.toLowerCase())
      )
    : wishListCategorySuggestions;

  const handleFormSubmit: SubmitHandler<TaskFormInputs> = (data) => {
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
    
    // Which recurrence types have event dates — from lib/recurrence, which is
    // the same list the engine itself branches on. It used to be re-typed here.
    const isEventBased = hasEventDate(data.recurrenceType || "");

    let dueDate = data.dueDate || null;
    let displayDate = null;
    let displayDateOffset = null;

    if (data.isRecurring) {
      // Just the pattern and where it currently sits — which is all
      // `calculateNextRecurrence` reads. This was a whole fabricated `Task`,
      // fifteen fields of which (title, price, timestamps…) the engine has never
      // looked at; it dated from before the engine took a rule rather than a
      // Task. Narrowing it means a new column on `Task` no longer has to be
      // invented here to satisfy the type.
      const rule: RecurrenceRule & RecurrenceAnchor = {
        dueDate: null,
        displayDate: null,
        displayDateOffset: isEventBased ? data.displayDateOffset ?? 0 : null,
        isRecurring: true,
        recurrenceType: data.recurrenceType as RecurrenceType,
        recurrenceInterval: data.recurrenceInterval || null,
        recurrenceDayOfWeek: data.recurrenceDayOfWeek || null,
        recurrenceDayOfMonth: data.recurrenceDayOfMonth || null,
        recurrenceWeekOfMonth: data.recurrenceWeekOfMonth || null,
        recurrenceDayOfWeekMonthly: data.recurrenceDayOfWeekMonthly || null,
        recurrenceMonth: data.recurrenceMonth || null,
      };

      // Calculate proper dates based on recurrence
      // Pass true for isInitialCreation to get correct initial displayDate
      const calculatedDates = calculateNextRecurrence(rule, timeZoneSettings, true);
      dueDate = calculatedDates.dueDate;
      displayDate = calculatedDates.displayDate;
      displayDateOffset = isEventBased ? data.displayDateOffset ?? 0 : null;
    } else {
      // Non-recurring tasks use dueDate and optionally displayDate
      dueDate = data.dueDate || null;
      displayDate = data.displayDate || null;
    }

    const payload = {
      title: data.title,
      description: filteredDescription,
      dueDate: dueDate,
      displayDate: displayDate,
      displayDateOffset: displayDateOffset,
      completed: task?.completed ?? false,
      completedAt: task?.completedAt ?? null,
      isRecurring: data.isRecurring,
      recurrenceType: data.isRecurring ? data.recurrenceType : "none",
      recurrenceInterval: data.recurrenceInterval || null,
      recurrenceDayOfWeek:
        data.recurrenceType === "weekly" || data.recurrenceType === "biweekly"
          ? data.recurrenceDayOfWeek
          : null,
      recurrenceDayOfMonth:
        data.recurrenceType === "monthly date" ||
        data.recurrenceType === "annually"
          ? data.recurrenceDayOfMonth
          : null,
      recurrenceWeekOfMonth:
        data.recurrenceType === "monthly day"
          ? data.recurrenceWeekOfMonth
          : null,
      recurrenceDayOfWeekMonthly:
        data.recurrenceType === "monthly day"
          ? data.recurrenceDayOfWeekMonthly
          : null,
      recurrenceMonth:
        data.recurrenceType === "annually" ? data.recurrenceMonth : null,
      project: data.projectDocumentId || null,
      trackingUrl: data.trackingUrl || null,
      purchaseUrl: data.purchaseUrl || null,
      price: data.price || null,
      wishListCategory: data.wishListCategory || null,
      soon: data.soon,
      long: data.long,
    };

    onSubmit(payload);
  };

  return (
    <form className="task-form" onSubmit={handleSubmit(handleFormSubmit)}>
      <h3>{task ? "edit task" : "new task"}</h3>

      {/* project */}
      <div className="task-form-element">
        <label htmlFor="project">project</label>
        <ProjectSelector
          value={unifiedValue}
          onChange={(documentId, projectType) => {
            setValue("projectDocumentId", documentId);
            setSelectedProjectType(projectType);
            if (!allowsRecurring(projectType)) {
              setValue("isRecurring", false);
            }
          }}
        />
      </div>

      {/* title */}
      <div className="task-form-element">
        <label htmlFor="title">title</label>
        <input
          id="title"
          placeholder="what"
          type="text"
          {...register("title")}
        />
        {errors.title && <span className="error">{errors.title.message}</span>}
      </div>

      {/* description */}
      <div className="task-form-element">
        <label htmlFor="description">description</label>
        <RichTextEditor value={description} onChange={setDescription} />
      </div>

      {/* tracking url */}
      {showTrackingUrl(selectedProjectType) && (
        <div className="task-form-element">
          <label htmlFor="trackingUrl">tracking url</label>
          <input
            id="trackingUrl"
            type="url"
            placeholder="tracking url"
            {...register("trackingUrl")}
          />
        </div>
      )}

      {/* purchase url */}
      {showPurchaseUrl(selectedProjectType) && (
        <div className="task-form-element">
          <label htmlFor="purchaseUrl">purchase url</label>
          <input
            id="purchaseUrl"
            type="url"
            placeholder="purchase url"
            {...register("purchaseUrl")}
          />
        </div>
      )}

      {/* price and wish list category */}
      {showPriceAndWishlistCategory(selectedProjectType) && (
        <>
          <div className="task-form-element">
            <label htmlFor="price">price</label>
            <input
              id="price"
              type="number"
              placeholder="price"
              {...register("price", { valueAsNumber: true })}
            />
          </div>
          <div className="task-form-element">
            <label htmlFor="wishListCategory">wish list category</label>
            <input
              id="wishListCategory"
              type="text"
              placeholder="wish list category"
              value={wishListCategoryInput}
              onChange={(e) => {
                const value = e.target.value;
                setWishListCategoryInput(value);
                setValue("wishListCategory", value);
                setShowWishListCategorySuggestions(true);
              }}
              onFocus={() => setShowWishListCategorySuggestions(true)}
              onBlur={() => {
                // Delay hiding suggestions to allow clicking on them
                setTimeout(
                  () => setShowWishListCategorySuggestions(false),
                  200
                );
              }}
            />
            {showWishListCategorySuggestions &&
              filteredWishListCategorySuggestions.length > 0 && (
                <ul className="wishListCategory-autocomplete">
                  {filteredWishListCategorySuggestions.map((suggestion) => (
                    <li
                      key={suggestion}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setWishListCategoryInput(suggestion);
                        setValue("wishListCategory", suggestion);
                        setShowWishListCategorySuggestions(false);
                      }}
                    >
                      {suggestion}
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </>
      )}

      {/* checkboxes */}
      <div className="row-one-one-one row-short">
        {showRecurringCheckbox(selectedProjectType) && (
          <div className="task-form-element">
            <label>
              <input
                type="checkbox"
                checked={isRecurring}
                className="checkbox"
                onChange={(e) => {
                  setValue("isRecurring", e.target.checked);
                }}
              />
              recurring
            </label>
          </div>
        )}
        {showSoonCheckbox(selectedProjectType, isRecurring) && (
          <div className="task-form-element">
            <label>
              <input
                type="checkbox"
                {...register("soon")}
                className="checkbox"
              />
              soon
            </label>
          </div>
        )}

        {showLongCheckbox(selectedProjectType) && (
          <div className="task-form-element">
            <label>
              <input
                type="checkbox"
                {...register("long")}
                className="checkbox"
              />
              long
            </label>
          </div>
        )}
      </div>

      {/* display date and due date */}
      {showDateFields(selectedProjectType, isRecurring) && (
        <div className="row-one-one">
          <div className="task-form-element labelled">
            <label htmlFor="displayDate">display date</label>
            <input
              id="displayDate"
              type="date"
              {...register("displayDate")}
            />
            {errors.displayDate && (
              <span className="error">{errors.displayDate.message}</span>
            )}
          </div>
          <div className="task-form-element labelled">
            <label htmlFor="dueDate">due date</label>
            <input id="dueDate" type="date" {...register("dueDate")} />
            {errors.dueDate && (
              <span className="error">{errors.dueDate.message}</span>
            )}
          </div>
        </div>
      )}

      {/* recurrence options */}
      {isRecurring && (
        <RecurrencePicker
          value={recurrenceRule}
          onChange={(next) => {
            // react-hook-form stays the single source of truth; the picker is
            // controlled off `watch`, so writing back here re-renders it with
            // the new value. `shouldDirty` keeps the form's dirty tracking
            // honest now that these fields are no longer `register`ed.
            (Object.keys(next) as Array<keyof RecurrenceRule>).forEach((key) => {
              if (next[key] !== recurrenceRule[key]) {
                setValue(key, next[key] as never, { shouldDirty: true });
              }
            });
          }}
          offset={{
            value: watchedOffset ?? 0,
            onChange: (offset) =>
              setValue("displayDateOffset", offset, { shouldDirty: true }),
          }}
          // Without these the superRefine rules fail silently: the create button
          // does nothing, the drawer stays open, and nothing says why. Only
          // title/displayDate/dueDate ever rendered their message.
          errors={{
            recurrenceInterval: errors.recurrenceInterval?.message,
            recurrenceDayOfWeek: errors.recurrenceDayOfWeek?.message,
            recurrenceDayOfMonth: errors.recurrenceDayOfMonth?.message,
            recurrenceWeekOfMonth: errors.recurrenceWeekOfMonth?.message,
            recurrenceDayOfWeekMonthly: errors.recurrenceDayOfWeekMonthly?.message,
            recurrenceMonth: errors.recurrenceMonth?.message,
          }}
        />
      )}

      {/* send button */}
      <div className="form-actions">
        <button className="btn" type="submit">
          {task ? "update" : "create"} task
        </button>
      </div>
    </form>
  );
}
