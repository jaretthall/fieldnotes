import { create } from 'zustand';
import type { Entry, CreateEntryInput, ListEntriesOpts, PaginatedResult } from '../../../shared/types';

interface EntriesState {
  entries: Entry[];
  selectedEntryId: string | null;
  selectedEntry: Entry | null;
  total: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;

  // Actions
  loadEntries: (opts?: ListEntriesOpts) => Promise<void>;
  createEntry: (input: CreateEntryInput) => Promise<Entry>;
  updateEntry: (id: string, patch: Partial<Entry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  selectEntry: (id: string | null) => Promise<void>;
  refreshSelectedEntry: () => Promise<void>;
}

export const useEntriesStore = create<EntriesState>((set, get) => ({
  entries: [],
  selectedEntryId: null,
  selectedEntry: null,
  total: 0,
  hasMore: false,
  loading: false,
  error: null,

  loadEntries: async (opts?: ListEntriesOpts) => {
    set({ loading: true, error: null });
    try {
      const result: PaginatedResult<Entry> = await window.api.invoke('entries:list', opts ?? {
        limit: 50,
        offset: 0,
        sortBy: 'created_at',
        sortOrder: 'desc',
      });
      set({
        entries: result.data,
        total: result.total,
        hasMore: result.hasMore,
        loading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createEntry: async (input: CreateEntryInput) => {
    set({ error: null });
    try {
      const entry = await window.api.invoke('entries:create', input);
      // Prepend new entry to the list
      set((state) => ({
        entries: [entry, ...state.entries],
        total: state.total + 1,
        selectedEntryId: entry.id,
        selectedEntry: entry,
      }));
      return entry;
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  updateEntry: async (id: string, patch: Partial<Entry>) => {
    try {
      const updated = await window.api.invoke('entries:update', id, patch);
      set((state) => ({
        entries: state.entries.map((e) => (e.id === id ? updated : e)),
        selectedEntry: state.selectedEntryId === id ? updated : state.selectedEntry,
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  deleteEntry: async (id: string) => {
    try {
      await window.api.invoke('entries:delete', id);
      set((state) => ({
        entries: state.entries.filter((e) => e.id !== id),
        total: state.total - 1,
        selectedEntryId: state.selectedEntryId === id ? null : state.selectedEntryId,
        selectedEntry: state.selectedEntryId === id ? null : state.selectedEntry,
      }));
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  selectEntry: async (id: string | null) => {
    if (!id) {
      set({ selectedEntryId: null, selectedEntry: null });
      return;
    }
    try {
      const entry = await window.api.invoke('entries:getById', id);
      set({ selectedEntryId: id, selectedEntry: entry });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  refreshSelectedEntry: async () => {
    const { selectedEntryId } = get();
    if (selectedEntryId) {
      const entry = await window.api.invoke('entries:getById', selectedEntryId);
      set({ selectedEntry: entry });
    }
  },
}));
