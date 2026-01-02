"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { usePractice } from "@/app/contexts/PracticeContext";
import { PlayIcon, StopIcon } from "@phosphor-icons/react";
import type { PracticeLog, StrapiBlock } from "@/app/types/admin";
import PracticeTimer from "./components/PracticeTimer";
import PracticeSessionItem from "./components/PracticeSessionItem";
import RichTextEditor from "@/app/components/admin/RichTextEditor";
import PracticeCharts from "./components/PracticeCharts";
import { toISODateInEST, getTodayInEST } from "@/app/lib/dateUtils";
import FaviconManager from "@/app/components/FaviconManager";

export default function PracticePage() {
  const { selectedPracticeType } = usePractice();
  const [practiceLogs, setPracticeLogs] = useState<PracticeLog[]>([]);
  const [activeSession, setActiveSession] = useState<PracticeLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSessionNotes, setActiveSessionNotes] = useState<StrapiBlock[]>(
    []
  );
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchPracticeLogs();
  }, [selectedPracticeType]);

  const fetchPracticeLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/practice-logs?type=${encodeURIComponent(selectedPracticeType)}`
      );
      const result = await response.json();

      if (result.success) {
        const logs: PracticeLog[] = result.data;
        setPracticeLogs(logs);

        // Find active session (one without stop time)
        const active = logs.find((log) => !log.stop);
        setActiveSession(active || null);

        // Update active session notes state
        if (active) {
          setActiveSessionNotes(active.notes || []);
        } else {
          setActiveSessionNotes([]);
        }
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Failed to fetch practice logs");
      console.error("Error fetching practice logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (activeSession) {
      // Shouldn't happen, but prevent starting if there's already an active session
      return;
    }

    try {
      setIsStarting(true);
      const now = new Date();
      const startTime = now.toISOString();
      const date = toISODateInEST(now);

      const response = await fetch("/api/practice-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: startTime,
          stop: null,
          type: selectedPracticeType,
          notes: [],
          duration: 0,
          date: date,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          await fetchPracticeLogs();
        }
      }
    } catch (err) {
      console.error("error starting practice session:", err);
      setError("failed to start practice session");
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    if (!activeSession) return;

    try {
      setIsStopping(true);
      const response = await fetch(
        `/api/practice-logs/${activeSession.documentId}/stop`,
        {
          method: "POST",
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          await fetchPracticeLogs();
        }
      }
    } catch (err) {
      console.error("error stopping practice session:", err);
      setError("failed to stop practice session");
    } finally {
      setIsStopping(false);
    }
  };

  const handleUpdate = async (documentId: string, data: any) => {
    try {
      const response = await fetch(`/api/practice-logs/${documentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        await fetchPracticeLogs();
      } else {
        const errorData = await response.json();
        console.error("error updating practice log:", errorData);
        setError(errorData.error || "failed to update practice session");
      }
    } catch (err) {
      console.error("error updating practice log:", err);
      setError("failed to update practice session");
    }
  };

  const handleDelete = async (documentId: string) => {
    try {
      const response = await fetch(`/api/practice-logs/${documentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchPracticeLogs();
      }
    } catch (err) {
      console.error("error deleting practice log:", err);
      setError("failed to delete practice session");
    }
  };

  // Manual save handler
  const handleManualSave = async () => {
    if (!activeSession) return;

    setIsSaving(true);
    try {
      await fetch(`/api/practice-logs/${activeSession.documentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: activeSessionNotes }),
      });
    } catch (err) {
      console.error("error saving notes:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Debounced auto-save for active session notes
  const handleNotesChange = useCallback(
    (notes: StrapiBlock[]) => {
      setActiveSessionNotes(notes);

      if (activeSession) {
        // Clear existing timeout
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        // Set new timeout for auto-save
        saveTimeoutRef.current = setTimeout(async () => {
          try {
            await fetch(`/api/practice-logs/${activeSession.documentId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ notes }),
            });
          } catch (err) {
            console.error("error auto-saving notes:", err);
          }
        }, 500);
      }
    },
    [activeSession]
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
    return <main id="admin-practice"></main>;
  }

  if (error) {
    return (
      <main id="admin-practice">
        <p>error: {error}</p>
      </main>
    );
  }

  // Filter out active session and only show sessions from past 30 days
  const today = getTodayInEST();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // 29 days ago + today = 30 days total
  const thirtyDaysAgoString = toISODateInEST(thirtyDaysAgo);
  
  const completedLogs = practiceLogs.filter((log) => 
    log.stop !== null && log.date >= thirtyDaysAgoString
  );

  return (
    <>
      <FaviconManager type="metronome" />
      <main id="admin-practice">
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
                  disabled={isSaving}
                >
                  {isSaving ? "saving..." : "save"}
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
                onUpdate={handleUpdate}
                onDelete={handleDelete}
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
