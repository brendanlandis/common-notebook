import { describe, expect, it } from 'vitest';

import { SCALAR_FIELDS, todoToTaskData } from './todoToTaskData';

// A fully-populated todo document, as returned by
// strapi.documents('api::todo.todo').findMany({ populate: ['owner','project'] }).
const fullTodo = {
  id: 10,
  documentId: 'todo-doc-1',
  title: 'Buy strings',
  description: [{ type: 'paragraph', children: [{ type: 'text', text: 'hi' }] }],
  completed: true,
  completedAt: '2026-01-02T03:04:05.000Z',
  dueDate: '2026-02-01',
  isRecurring: true,
  recurrenceType: 'weekly',
  recurrenceInterval: 2,
  recurrenceDayOfWeek: 3,
  recurrenceDayOfMonth: null,
  recurrenceWeekOfMonth: null,
  recurrenceDayOfWeekMonthly: null,
  recurrenceMonth: null,
  category: 'band chores',
  displayDate: '2026-01-15',
  displayDateOffset: -2,
  trackingUrl: 'http://track',
  purchaseUrl: 'http://buy',
  price: 4200,
  wishListCategory: 'gear',
  soon: true,
  long: true,
  workSessions: [{ date: '2026-01-01', timestamp: '2026-01-01T00:00:00.000Z' }],
  owner: { id: 7, username: 'brendan' },
  project: { id: 3, documentId: 'proj-doc-9', title: 'Guitar' },
  createdAt: '2025-12-01T00:00:00.000Z',
  updatedAt: '2025-12-31T00:00:00.000Z',
  publishedAt: '2025-12-01T00:00:00.000Z',
};

describe('todoToTaskData', () => {
  it('copies every shared scalar field verbatim', () => {
    const { data } = todoToTaskData(fullTodo);
    for (const f of SCALAR_FIELDS) {
      expect(data[f], f).toEqual(fullTodo[f]);
    }
  });

  it('extracts owner by numeric id and project by documentId', () => {
    const { data } = todoToTaskData(fullTodo);
    expect(data.owner).toBe(7);
    expect(data.project).toBe('proj-doc-9');
  });

  it('passes description (blocks) and workSessions (json) through by value', () => {
    const { data } = todoToTaskData(fullTodo);
    expect(data.description).toEqual(fullTodo.description);
    expect(data.workSessions).toEqual(fullTodo.workSessions);
  });

  it('preserves the source timestamps for re-application', () => {
    const { timestamps } = todoToTaskData(fullTodo);
    expect(timestamps).toEqual({
      createdAt: '2025-12-01T00:00:00.000Z',
      updatedAt: '2025-12-31T00:00:00.000Z',
      publishedAt: '2025-12-01T00:00:00.000Z',
    });
  });

  it('carries the source documentId for verification but not into the new row', () => {
    const { data, sourceDocumentId } = todoToTaskData(fullTodo);
    expect(sourceDocumentId).toBe('todo-doc-1');
    expect(data).not.toHaveProperty('id');
    expect(data).not.toHaveProperty('documentId');
  });

  it('normalizes a null or absent `long` to false (task’s new default)', () => {
    expect(todoToTaskData({ ...fullTodo, long: true }).data.long).toBe(true);
    expect(todoToTaskData({ ...fullTodo, long: false }).data.long).toBe(false);
    expect(todoToTaskData({ ...fullTodo, long: null }).data.long).toBe(false);
    const { long, ...withoutLong } = fullTodo;
    expect(todoToTaskData(withoutLong).data.long).toBe(false);
  });

  it('handles an incidental todo (no project) and preserves explicit null scalars', () => {
    const incidental = { ...fullTodo, project: null, dueDate: null, category: null };
    const { data } = todoToTaskData(incidental);
    expect(data.project).toBeNull();
    expect(data.dueDate).toBeNull();
    expect(data.category).toBeNull();
  });

  it('extracts a null owner when absent — the orchestration guards against orphans', () => {
    expect(todoToTaskData({ ...fullTodo, owner: null }).data.owner).toBeNull();
    expect(todoToTaskData({ ...fullTodo, owner: undefined }).data.owner).toBeNull();
  });

  it('omits keys that are absent on the source (left for Strapi defaults)', () => {
    const { title, price, ...sparse } = fullTodo;
    const { data } = todoToTaskData(sparse);
    expect(data).not.toHaveProperty('title');
    expect(data).not.toHaveProperty('price');
  });

  it('rejects a non-object input', () => {
    expect(() => todoToTaskData(null)).toThrow(TypeError);
    expect(() => todoToTaskData(undefined)).toThrow(TypeError);
    expect(() => todoToTaskData('nope')).toThrow(TypeError);
  });
});
