"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiSend } from "@/app/lib/apiFetch";
import type { ClientCalendar } from "@/app/lib/ics/clientCalendar";
import { Field, Input } from "@/app/components/FormControls";

/**
 * Subscribing to calendars, by pasting a secret ICS URL each.
 *
 * One at a time is a feature rather than a limitation: it makes "which calendars
 * exist in this app at all" a curated act, which is effectively a free state
 * above show/hide — a calendar never worth a thought never gets added.
 *
 * The URL is write-only from the browser's side. It goes up on create and is
 * never sent back down, so an existing subscription shows only whether a URL is
 * set. Replacing one means deleting and re-adding, which is the honest UI for a
 * credential you cannot read back.
 */

const CALENDARS_LIST_KEY = ["calendars", "list"] as const;

interface CalendarsResponse {
  success?: boolean;
  data?: ClientCalendar[];
}

export default function CalendarsManager() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [icsUrl, setIcsUrl] = useState("");

  const { data, isPending } = useQuery({
    queryKey: CALENDARS_LIST_KEY,
    queryFn: () => apiFetch<CalendarsResponse>("/api/calendars"),
  });
  const calendars = data?.data ?? [];

  const invalidate = () =>
    // The whole ['calendars'] family: adding a feed changes the week's events,
    // not just this list.
    queryClient.invalidateQueries({ queryKey: ["calendars"] });

  const add = useMutation({
    mutationFn: (body: { name: string; icsUrl: string }) =>
      apiSend("/api/calendars", "POST", body),
    onSuccess: () => {
      setName("");
      setIcsUrl("");
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (documentId: string) =>
      apiSend(`/api/calendars/${documentId}`, "DELETE"),
    onSuccess: invalidate,
  });

  return (
    <div className="flex flex-col gap-4">
      {isPending ? (
        <p>loading...</p>
      ) : (
        <ul className="divide-y divide-base-content/10">
          {calendars.map((calendar) => (
            <li
              key={calendar.documentId}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="min-w-0 truncate">
                {calendar.name}
                {!calendar.hasUrl && (
                  <span className="ml-2 text-sm italic">no url</span>
                )}
              </span>
              <button
                type="button"
                className="btn btn-sm m-0 shrink-0 px-3"
                aria-label={`remove ${calendar.name}`}
                onClick={() => remove.mutate(calendar.documentId)}
                disabled={remove.isPending}
              >
                remove
              </button>
            </li>
          ))}
          {calendars.length === 0 && (
            <li className="py-2 text-sm italic">no calendars yet</li>
          )}
        </ul>
      )}

      <Field label="name" htmlFor="calendarName">
        <Input
          id="calendarName"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="secret ics url" htmlFor="calendarUrl">
        <Input
          id="calendarUrl"
          type="url"
          value={icsUrl}
          placeholder="https://calendar.google.com/calendar/ical/..."
          onChange={(e) => setIcsUrl(e.target.value)}
        />
      </Field>
      <button
        type="button"
        className="btn m-0 self-start"
        disabled={!name || !icsUrl || add.isPending}
        onClick={() => add.mutate({ name, icsUrl })}
      >
        add calendar
      </button>
      {/* Shown rather than logged: a rejected URL that looks accepted would
          leave a calendar silently missing from every future review. */}
      {add.error && <p className="text-sm italic">{add.error.message}</p>}
    </div>
  );
}
