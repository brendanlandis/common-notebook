'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { XIcon } from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import Drawer, { DrawerClose, DRAWER_PANEL } from '@/app/components/ui/Drawer';
import DrawerHeader from '@/app/components/ui/DrawerHeader';
import { CONTROL_ICON } from '@/app/components/chrome/iconSizes';
import { useTaskActions } from '@/app/(main)/(todo)/contexts/TaskActionsContext';
import ProjectForm from '@/app/(main)/(todo)/components/ProjectForm';
import PieceForm from '@/app/(main)/practice/components/PieceForm';
import DayEditor from '@/app/(main)/practice/components/DayEditor';
import { usePracticeSubject } from '@/app/(main)/practice/hooks/usePracticePage';
import { useWorlds } from '@/app/(main)/(todo)/hooks/useWorlds';
import { TASKS_ROOT } from '@/app/(main)/(todo)/hooks/useTasks';
import { PROJECTS_QUERY_KEY } from '@/app/hooks/useProjects';
import { apiSend, swallow } from '@/app/lib/apiFetch';
import { isPracticeWorld } from '@/app/lib/worlds';
import type { Task } from '@/app/types/index';

/**
 * The practice page's drawer: edit a piece, add a piece to the subject on
 * screen, add a subject. The task pages have their own (`TaskForms`), tied to
 * their views; this one only needs the task list to re-read.
 *
 * Opened from two places. The header's add buttons open it through the shared
 * drawer state (`TaskActionsContext`), since the header sits outside this page;
 * a piece's pencil opens it through `editPiece` below, which names the piece.
 */
const PracticeFormsContext = createContext<{
  editPiece: (piece: Task) => void;
  /** Open a day of history to put right; `label` is how history names the day. */
  editDay: (date: string, label: string) => void;
} | null>(null);

export function usePracticeForms() {
  const context = useContext(PracticeFormsContext);
  if (!context) throw new Error('usePracticeForms must be used within PracticeFormsProvider');
  return context;
}

export function PracticeFormsProvider({ children }: { children: ReactNode }) {
  const { drawerContent, isOpen, openTaskForm, closeDrawer, onDrawerExited } = useTaskActions();
  const [editing, setEditing] = useState<Task | null>(null);
  // The day being edited has a drawer of its own: it isn't a task or a project,
  // so the shared drawer state has no word for it.
  const [day, setDay] = useState<{ date: string; label: string } | null>(null);
  const [dayOpen, setDayOpen] = useState(false);
  const editDay = useCallback((date: string, label: string) => {
    setDay({ date, label });
    setDayOpen(true);
  }, []);
  const queryClient = useQueryClient();
  const { subject } = usePracticeSubject();
  const { worlds } = useWorlds();
  const practiceWorld = worlds.find((w) => isPracticeWorld(w))?.documentId;

  const editPiece = useCallback(
    (piece: Task) => {
      setEditing(piece);
      openTaskForm();
    },
    [openTaskForm],
  );

  const reread = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: TASKS_ROOT });
    void queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY });
  }, [queryClient]);

  const close = useCallback(() => {
    closeDrawer();
  }, [closeDrawer]);

  const savePiece = (payload: Record<string, unknown>) => {
    const piece = editing;
    close();
    swallow(
      'save piece',
      (piece
        ? apiSend(`/api/tasks/${piece.documentId}`, 'PUT', payload)
        : apiSend('/api/tasks', 'POST', payload)
      ).finally(reread),
    );
  };

  const deletePiece = () => {
    const piece = editing;
    if (!piece || !confirm(`Delete "${piece.title}"?`)) return;
    close();
    swallow('delete piece', apiSend(`/api/tasks/${piece.documentId}`, 'DELETE').finally(reread));
  };

  const saveSubject = (data: Record<string, unknown>) => {
    close();
    swallow('save subject', apiSend('/api/projects', 'POST', data).finally(reread));
  };

  const value = useMemo(() => ({ editPiece, editDay }), [editPiece, editDay]);

  const title =
    drawerContent === 'task' ? (editing ? 'edit piece' : 'new piece') : 'new subject';

  return (
    <PracticeFormsContext.Provider value={value}>
      {children}
      <Drawer
        open={isOpen && (drawerContent === 'task' || drawerContent === 'project')}
        onOpenChange={(open) => !open && close()}
        title={title}
        onExited={() => {
          setEditing(null);
          onDrawerExited();
        }}
      >
        <div className={`actions-drawer ${DRAWER_PANEL}`}>
          <DrawerHeader title={title}>
            <DrawerClose aria-label="close">
              <XIcon size={CONTROL_ICON} weight="regular" />
            </DrawerClose>
          </DrawerHeader>
          {drawerContent === 'task' && (
            <PieceForm
              key={editing?.documentId ?? `new-${subject?.documentId ?? ''}`}
              piece={editing ?? undefined}
              subjectId={subject?.documentId}
              onSubmit={savePiece}
              onDelete={editing ? deletePiece : undefined}
            />
          )}
          {drawerContent === 'project' && (
            <ProjectForm defaultWorld={practiceWorld} onSubmit={saveSubject} onCancel={close} />
          )}
        </div>
      </Drawer>

      <Drawer
        open={dayOpen}
        onOpenChange={setDayOpen}
        title={day?.label ?? 'day'}
        onExited={() => setDay(null)}
      >
        <div className={`actions-drawer ${DRAWER_PANEL}`}>
          <DrawerHeader title={day?.label ?? ''}>
            <DrawerClose aria-label="close">
              <XIcon size={CONTROL_ICON} weight="regular" />
            </DrawerClose>
          </DrawerHeader>
          {day && <DayEditor key={day.date} date={day.date} onDone={() => setDayOpen(false)} />}
        </div>
      </Drawer>
    </PracticeFormsContext.Provider>
  );
}
