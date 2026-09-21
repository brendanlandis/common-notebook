"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiSend } from "@/app/lib/apiFetch";
import type { ClientCalendar } from "@/app/lib/ics/clientCalendar";
import { Field, Input } from "@/app/components/ui/FormControls";
import Button from "@/app/components/ui/Button";

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
    <div className="flex flex-col">
      {isPending ? (
        <p>loading...</p>
      ) : (
        <ul className="divide-y divide-base-content/10">
          {calendars.map((calendar) => (
            <li
              key={calendar.documentId}
              className="flex items-center justify-between"
            >
              <span className="min-w-0 truncate">
                {calendar.name}
                {!calendar.hasUrl && (
                  <span className="text-small italic">no url</span>
                )}
              </span>
              <Button
                small
                className="shrink-0"
                aria-label={`remove ${calendar.name}`}
                onClick={() => remove.mutate(calendar.documentId)}
                disabled={remove.isPending}
              >
                remove
              </Button>
            </li>
          ))}
          {calendars.length === 0 && (
            <li className="text-small italic">no calendars yet</li>
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
      <Button
        className="self-start"
        disabled={!name || !icsUrl || add.isPending}
        onClick={() => add.mutate({ name, icsUrl })}
      >
        add calendar
      </Button>
      {/* Shown rather than logged: a rejected URL that looks accepted would
          leave a calendar silently missing from every future review. */}
      {add.error && <p className="text-small italic">{add.error.message}</p>}
    </div>
  );
}
