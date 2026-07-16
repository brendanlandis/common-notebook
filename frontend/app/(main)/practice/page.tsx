"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { usePractice } from "@/app/contexts/PracticeContext";
import { PlayIcon, StopIcon } from "@phosphor-icons/react";
import type { StrapiBlock } from "@/app/types/index";
import PracticeTimer from "./components/PracticeTimer";
import PracticeSessionItem from "./components/PracticeSessionItem";
import RichTextEditor from "@/app/components/RichTextEditor";
import PracticeCharts from "./components/PracticeCharts";
import { toISODate, getToday } from "@/app/lib/dateUtils";
import { useDateTimeSettings } from "@/app/contexts/DateTimeSettingsContext";
import { usePracticeLogs } from "./hooks/usePracticeLogs";
import FaviconManager from "@/app/components/FaviconManager";

export default function PracticePage() {
  const { timeZoneSettings } = useDateTimeSettings();
  const { selectedPracticeType } = usePractice();
  const {
    logs,
    activeSession,
    loading,
    error,
    start,
    stop,
    update,
    remove,
    saveNotes,
    isStarting,
    isStopping,
    isSavingNotes,
  } = usePracticeLogs(selectedPracticeType);

  const [activeSessionNotes, setActiveSessionNotes] = useState<StrapiBlock[]>([]);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Seed the editor when a *different* session becomes active — not on every
  // refetch. The list refetches on window focus now, and the old code re-seeded
  // the editor from the response every time, which would drop whatever had been
  // typed since. Keyed on identity so an unrelated refetch leaves the text alone.
  const seededSessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    const activeId = activeSession?.documentId ?? null;
    if (activeId === seededSessionIdRef.current) return;
    seededSessionIdRef.current = activeId;
    setActiveSessionNotes(activeSession?.notes ?? []);
  }, [activeSession]);

  const handleStart = async () => {
    if (activeSession) return; // guard: never two open sessions
    const now = new Date();
    await start({
      start: now.toISOString(),
      stop: null,
      type: selectedPracticeType,
      notes: [],
      duration: 0,
      date: toISODate(now, timeZoneSettings),
    });
  };

  const handleStop = async () => {
    if (!activeSession) return;
    await stop(activeSession.documentId);
  };

  const handleManualSave = async () => {
    if (!activeSession) return;
    await saveNotes(activeSession.documentId, activeSessionNotes);
  };

  // Debounced auto-save for active session notes
  const handleNotesChange = useCallback(
    (notes: StrapiBlock[]) => {
      setActiveSessionNotes(notes);
      if (!activeSession) return;

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        void saveNotes(activeSession.documentId, notes);
      }, 500);
    },
    [activeSession, saveNotes]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (loading) {
    return <main id="container-practice"></main>;
  }

  if (error) {
    return (
      <main id="container-practice">
        <p>error: {error}</p>
      </main>
    );
  }

  // Filter out active session and only show sessions from past 30 days
  const today = getToday(timeZoneSettings);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // 29 days ago + today = 30 days total
  const thirtyDaysAgoString = toISODate(thirtyDaysAgo, timeZoneSettings);

  const completedLogs = logs.filter(
    (log) => log.stop !== null && log.date >= thirtyDaysAgoString
  );

  return (
    <>
      <FaviconManager type="metronome" />
      <main id="container-practice">
        <div className="practice-controls">
          {activeSession ? (
            <div className="active-session">
              <button
                className="stop-button"
                onClick={handleStop}
                disabled={isStopping}
              >
                <StopIcon size={80} weight="regular" />
              </button>
              <div className="session-info">
                <PracticeTimer startTime={activeSession.start} />
                <RichTextEditor
                  value={activeSessionNotes}
                  onChange={handleNotesChange}
                />
                <button
                  className="btn save-button"
                  onClick={handleManualSave}
                  disabled={isSavingNotes}
                >
                  {isSavingNotes ? "saving..." : "save"}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="start-button"
              onClick={handleStart}
              disabled={isStarting}
            >
              <PlayIcon size={80} weight="regular" />
            </button>
          )}
        </div>

        <PracticeCharts />

        {completedLogs.length > 0 && (
          <div className="practice-sessions">
            <h3>Practice History</h3>
            {completedLogs.map((log) => (
              <PracticeSessionItem
                key={log.documentId}
                practiceLog={log}
                onUpdate={update}
                onDelete={remove}
              />
            ))}
          </div>
        )}

        {completedLogs.length === 0 && !activeSession && (
          <p className="no-sessions"></p>
        )}
      </main>
    </>
  );
}
