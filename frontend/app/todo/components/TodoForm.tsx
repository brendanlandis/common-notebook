"use client";

import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import ProjectSelector from "./ProjectSelector";
import type { Todo, RecurrenceType, TodoCategory, StrapiBlock } from "@/app/types/admin";
import { getNowInEST, toISODateInEST } from "@/app/lib/dateUtils";
import { calculateNextRecurrence } from "@/app/lib/recurrence";
import RichTextEditor from "@/app/components/admin/RichTextEditor";
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
  category: z.string().nullable().optional(),
  trackingUrl: z.string().nullable().optional(),
  purchaseUrl: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  wishListCategory: z.string().nullable().optional(),
  soon: z.boolean(),
  long: z.boolean(),
});

type TodoFormInputs = z.infer<typeof schema>;

interface TodoFormProps {
  todo?: Todo;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export default function TodoForm({ todo, onSubmit, onCancel }: TodoFormProps) {
  const [isRecurring, setIsRecurring] = useState(todo?.isRecurring || false);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(
    todo?.recurrenceType || "none"
  );
  const [selectedProject, setSelectedProject] = useState<string | null>(
    (todo?.project as any)?.documentId || null
  );
  const [selectedCategory, setSelectedCategory] = useState<TodoCategory | null>(
    todo?.category || null
  );
  const [description, setDescription] = useState<StrapiBlock[]>(
    todo?.description || []
  );

  // Compute unified value for ProjectSelector (handles both projects and categories)
  const unifiedValue = selectedProject
    ? selectedProject
    : selectedCategory
    ? `category:${selectedCategory}`
    : null;
  const [selectedMonth, setSelectedMonth] = useState<number>(
    todo?.recurrenceMonth || 1
  );
  const [displayDateOffset, setDisplayDateOffset] = useState<number>(
    todo?.displayDateOffset ?? 0
  );
  const [wishListCategorySuggestions, setWishListCategorySuggestions] =
    useState<string[]>([]);
  const [wishListCategoryInput, setWishListCategoryInput] = useState<string>(
    todo?.wishListCategory || ""
  );
  const [showWishListCategorySuggestions, setShowWishListCategorySuggestions] =
    useState(false);

  // Helper function to get the number of days in a month (including 29 for Feb)
  const getDaysInMonth = (month: number): number => {
    const daysInMonth: { [key: number]: number } = {
      1: 31, // January
      2: 29, // February (including leap year)
      3: 31, // March
      4: 30, // April
      5: 31, // May
      6: 30, // June
      7: 31, // July
      8: 31, // August
      9: 30, // September
      10: 31, // October
      11: 30, // November
      12: 31, // December
    };
    return daysInMonth[month] || 31;
  };

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<TodoFormInputs>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: todo?.title || "",
      description: todo?.description || [],
      dueDate: todo?.dueDate || "",
      displayDate: todo?.displayDate || null,
      displayDateOffset: todo?.displayDateOffset ?? 0,
      isRecurring: todo?.isRecurring || false,
      recurrenceType: todo?.recurrenceType || "none",
      recurrenceInterval: todo?.recurrenceInterval || null,
      recurrenceDayOfWeek: todo?.recurrenceDayOfWeek ?? 1,
      recurrenceDayOfMonth: todo?.recurrenceDayOfMonth ?? 1,
      recurrenceWeekOfMonth: todo?.recurrenceWeekOfMonth ?? 1,
      recurrenceDayOfWeekMonthly: todo?.recurrenceDayOfWeekMonthly ?? 1,
      recurrenceMonth: todo?.recurrenceMonth ?? 1,
      projectDocumentId: (todo?.project as any)?.documentId || null,
      category: todo?.category || null,
      trackingUrl: todo?.trackingUrl || null,
      purchaseUrl: todo?.purchaseUrl || null,
      price: todo?.price || null,
      wishListCategory: todo?.wishListCategory || null,
      soon: todo?.soon || false,
      long: todo?.long || false,
    },
  });

  // Fetch wishlist category suggestions when category is "wishlist"
  useEffect(() => {
    if (selectedCategory === "wishlist") {
      fetchWishListCategorySuggestions();
    }
  }, [selectedCategory]);

  const fetchWishListCategorySuggestions = async () => {
    try {
      const response = await fetch("/api/todos");
      const result = await response.json();
      if (result.success) {
        const allTodos: Todo[] = result.data;
        // Get unique, non-null wishListCategory values from wishlist todos
        const categories = new Set<string>();
        allTodos.forEach((todo) => {
          if (todo.category === "wishlist" && todo.wishListCategory) {
            categories.add(todo.wishListCategory.trim());
          }
        });
        setWishListCategorySuggestions(Array.from(categories).sort());
      }
    } catch (error) {
      console.error("Error fetching wishlist category suggestions:", error);
    }
  };

  // Filter suggestions based on input
  const filteredWishListCategorySuggestions = wishListCategoryInput
    ? wishListCategorySuggestions.filter((suggestion) =>
        suggestion.toLowerCase().includes(wishListCategoryInput.toLowerCase())
      )
    : wishListCategorySuggestions;

  const handleFormSubmit: SubmitHandler<TodoFormInputs> = (data) => {
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
    
    // Determine which recurrence types have event dates
    const hasEventDate = [
      "monthly date",
      "monthly day",
      "annually",
      "full moon",
      "new moon",
      "every season",
      "winter solstice",
      "spring equinox",
      "summer solstice",
      "autumn equinox",
    ].includes(data.recurrenceType || "");

    let dueDate = data.dueDate || null;
    let displayDate = null;
    let displayDateOffset = null;

    if (data.isRecurring) {
      // Create a temporary todo object to calculate proper dates
      const tempTodo: Todo = {
        id: 0,
        documentId: "",
        title: data.title,
        description: [],
        completed: false,
        completedAt: null,
        dueDate: null,
        displayDate: null,
        displayDateOffset: hasEventDate ? data.displayDateOffset ?? 0 : null,
        isRecurring: true,
        recurrenceType: data.recurrenceType as RecurrenceType,
        recurrenceInterval: data.recurrenceInterval || null,
        recurrenceDayOfWeek: data.recurrenceDayOfWeek || null,
        recurrenceDayOfMonth: data.recurrenceDayOfMonth || null,
        recurrenceWeekOfMonth: data.recurrenceWeekOfMonth || null,
        recurrenceDayOfWeekMonthly: data.recurrenceDayOfWeekMonthly || null,
        recurrenceMonth: data.recurrenceMonth || null,
        category: data.category as TodoCategory | null,
        trackingUrl: data.trackingUrl || null,
        purchaseUrl: data.purchaseUrl || null,
        price: data.price || null,
        wishListCategory: data.wishListCategory || null,
        soon: data.soon,
        long: data.long,
        workSessions: null,
        createdAt: "",
        updatedAt: "",
        publishedAt: "",
      };

      // Calculate proper dates based on recurrence
      // Pass true for isInitialCreation to get correct initial displayDate
      const calculatedDates = calculateNextRecurrence(tempTodo, true);
      dueDate = calculatedDates.dueDate;
      displayDate = calculatedDates.displayDate;
      displayDateOffset = hasEventDate ? data.displayDateOffset ?? 0 : null;
    } else {
      // Non-recurring todos use dueDate and optionally displayDate
      dueDate = data.dueDate || null;
      displayDate = data.displayDate || null;
    }

    const payload = {
      title: data.title,
      description: filteredDescription,
      dueDate: dueDate,
      displayDate: displayDate,
      displayDateOffset: displayDateOffset,
      completed: todo?.completed ?? false,
      completedAt: todo?.completedAt ?? null,
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
      category: data.category || null,
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
    <form className="todo-form" onSubmit={handleSubmit(handleFormSubmit)}>
      <h3>{todo ? "edit to-do" : "new to-do"}</h3>

      {/* project */}
      <div className="todo-form-element">
        <label htmlFor="project">project</label>
        <ProjectSelector
          value={unifiedValue}
          onChange={(value) => {
            if (value?.startsWith("category:")) {
              // It's a category
              const category = value.replace("category:", "") as TodoCategory;
              setSelectedCategory(category);
              setSelectedProject(null);
              setValue("category", category);
              setValue("projectDocumentId", null);
              // Disable recurring for categories that don't allow it
              if (!allowsRecurring(category)) {
                setIsRecurring(false);
                setValue("isRecurring", false);
              }
            } else if (value) {
              // It's a project documentId
              setSelectedProject(value);
              setSelectedCategory(null);
              setValue("projectDocumentId", value);
              setValue("category", null);
            } else {
              // Clear both
              setSelectedProject(null);
              setSelectedCategory(null);
              setValue("projectDocumentId", null);
              setValue("category", null);
            }
          }}
        />
      </div>

      {/* title */}
      <div className="todo-form-element">
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
      <div className="todo-form-element">
        <label htmlFor="description">description</label>
        <RichTextEditor value={description} onChange={setDescription} />
      </div>

      {/* tracking url */}
      {showTrackingUrl(selectedCategory) && (
        <div className="todo-form-element">
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
      {showPurchaseUrl(selectedCategory) && (
        <div className="todo-form-element">
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
      {showPriceAndWishlistCategory(selectedCategory) && (
        <>
          <div className="todo-form-element">
            <label htmlFor="price">price</label>
            <input
              id="price"
              type="number"
              placeholder="price"
              {...register("price", { valueAsNumber: true })}
            />
          </div>
          <div className="todo-form-element">
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
        {showRecurringCheckbox(selectedCategory) && (
          <div className="todo-form-element">
            <label>
              <input
                type="checkbox"
                checked={isRecurring}
                className="checkbox"
                onChange={(e) => {
                  setIsRecurring(e.target.checked);
                  setValue("isRecurring", e.target.checked);
                }}
              />
              recurring
            </label>
          </div>
        )}
        {showSoonCheckbox(selectedCategory, isRecurring) && (
          <div className="todo-form-element">
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

        {showLongCheckbox(selectedCategory) && (
          <div className="todo-form-element">
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
      {showDateFields(selectedCategory, isRecurring) && (
        <div className="row-one-one">
          <div className="todo-form-element labelled">
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
          <div className="todo-form-element labelled">
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
        <>
          <div className="todo-form-element">
            <label htmlFor="recurrenceType">recurrence type</label>
            <select
              id="recurrenceType"
              {...register("recurrenceType")}
              onChange={(e) => {
                setRecurrenceType(e.target.value as RecurrenceType);
                setValue("recurrenceType", e.target.value);
              }}
            >
              <optgroup label="the earth">
                <option value="daily">every day</option>
                <option value="every x days">every X days</option>
              </optgroup>
              <optgroup label="man's witless folly">
                <option value="weekly">weekly</option>
                <option value="biweekly">biweekly</option>
                <option value="monthly date">monthly (same date)</option>
                <option value="monthly day">monthly (same weekday)</option>
                <option value="annually">annually</option>
              </optgroup>
              <optgroup label="the heavens">
                <option value="full moon">full moon</option>
                <option value="new moon">new moon</option>
                <option value="every season">every season</option>
                <option value="winter solstice">winter solstice</option>
                <option value="spring equinox">spring equinox</option>
                <option value="summer solstice">summer solstice</option>
                <option value="autumn equinox">autumn equinox</option>
              </optgroup>{" "}
            </select>
          </div>

          {recurrenceType === "every x days" && (
            <div className="todo-form-element">
              <label htmlFor="recurrenceInterval">how many days</label>
              <input
                id="recurrenceInterval"
                type="number"
                placeholder="how many days"
                {...register("recurrenceInterval", { valueAsNumber: true })}
              />
            </div>
          )}

          {recurrenceType === "weekly" && (
            <div className="todo-form-element">
              <label htmlFor="recurrenceDayOfWeek">day of week</label>
              <select
                id="recurrenceDayOfWeek"
                {...register("recurrenceDayOfWeek", { valueAsNumber: true })}
              >
                <option value="1">mondays</option>
                <option value="2">tuesdays</option>
                <option value="3">wednesdays</option>
                <option value="4">thursdays</option>
                <option value="5">fridays</option>
                <option value="6">saturdays</option>
                <option value="7">sundays</option>
              </select>
            </div>
          )}

          {recurrenceType === "biweekly" && (
            <div className="todo-form-element">
              <label htmlFor="recurrenceDayOfWeek">day of week</label>
              <select
                id="recurrenceDayOfWeek"
                {...register("recurrenceDayOfWeek", { valueAsNumber: true })}
              >
                <option value="1">every other monday</option>
                <option value="2">every other tuesday</option>
                <option value="3">every other wednesday</option>
                <option value="4">every other thursday</option>
                <option value="5">every other friday</option>
                <option value="6">every other saturday</option>
                <option value="7">every other sunday</option>
              </select>
            </div>
          )}

          {recurrenceType === "monthly date" && (
            <div className="todo-form-element">
              <label htmlFor="recurrenceDayOfMonth">day of month (1-31)</label>
              <input
                id="recurrenceDayOfMonth"
                type="number"
                min="1"
                max="31"
                placeholder="day of month (1-31)"
                {...register("recurrenceDayOfMonth", { valueAsNumber: true })}
              />
            </div>
          )}

          {recurrenceType === "monthly day" && (
            <div className="row-one-two">
              <div className="todo-form-element">
                <label htmlFor="recurrenceWeekOfMonth">Week of Month</label>
                <select
                  id="recurrenceWeekOfMonth"
                  {...register("recurrenceWeekOfMonth", {
                    valueAsNumber: true,
                  })}
                >
                  <option value="1">the first</option>
                  <option value="2">the second</option>
                  <option value="3">the third</option>
                  <option value="-1">the last</option>
                </select>
              </div>
              <div className="todo-form-element">
                <label htmlFor="recurrenceDayOfWeekMonthly">day of week</label>
                <select
                  id="recurrenceDayOfWeekMonthly"
                  {...register("recurrenceDayOfWeekMonthly", {
                    valueAsNumber: true,
                  })}
                >
                  <option value="1">monday of the month</option>
                  <option value="2">tuesday of the month</option>
                  <option value="3">wednesday of the month</option>
                  <option value="4">thursday of the month</option>
                  <option value="5">friday of the month</option>
                  <option value="6">saturday of the month</option>
                  <option value="7">sunday of the month</option>
                </select>
              </div>
            </div>
          )}

          {recurrenceType === "annually" && (
            <div className="row-one-one">
              <div className="todo-form-element">
                <label htmlFor="recurrenceMonth">month</label>
                <select
                  id="recurrenceMonth"
                  {...register("recurrenceMonth", {
                    valueAsNumber: true,
                  })}
                  onChange={(e) => {
                    const month = parseInt(e.target.value);
                    setSelectedMonth(month);
                    setValue("recurrenceMonth", month);
                  }}
                >
                  <option value="1">january</option>
                  <option value="2">february</option>
                  <option value="3">march</option>
                  <option value="4">april</option>
                  <option value="5">may</option>
                  <option value="6">june</option>
                  <option value="7">july</option>
                  <option value="8">august</option>
                  <option value="9">september</option>
                  <option value="10">october</option>
                  <option value="11">november</option>
                  <option value="12">december</option>
                </select>
              </div>
              <div className="todo-form-element">
                <label htmlFor="recurrenceDayOfMonth">day of month</label>
                <select
                  id="recurrenceDayOfMonth"
                  {...register("recurrenceDayOfMonth", { valueAsNumber: true })}
                >
                  {Array.from(
                    { length: getDaysInMonth(selectedMonth) },
                    (_, i) => i + 1
                  ).map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {[
            "monthly date",
            "monthly day",
            "annually",
            "full moon",
            "new moon",
            "every season",
            "winter solstice",
            "spring equinox",
            "summer solstice",
            "autumn equinox",
          ].includes(recurrenceType) && (
            <div className="todo-form-element labelled">
              <label htmlFor="displayDateOffset">when to display</label>
              <select
                id="displayDateOffset"
                {...register("displayDateOffset", { valueAsNumber: true })}
                onChange={(e) => {
                  const offset = parseInt(e.target.value);
                  setDisplayDateOffset(offset);
                  setValue("displayDateOffset", offset);
                }}
              >
                <option value="0">day of</option>
                <option value="3">a few days before</option>
                <option value="7">a week before</option>
                <option value="14">two weeks before</option>
                <option value="30">a month before</option>
              </select>
            </div>
          )}
        </>
      )}

      {/* send button */}
      <div className="form-actions">
        <button className="btn" type="submit">
          {todo ? "update" : "create"} todo
        </button>
      </div>
    </form>
  );
}
