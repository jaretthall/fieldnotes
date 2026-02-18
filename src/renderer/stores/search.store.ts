import { create } from 'zustand';
import type { SearchResult, Entry } from '../../../shared/types';

interface SearchState {
  query: string;
  results: SearchResult[];
  loading: boolean;
  error: string | null;
  filters: {
    mood?: string;
    domain?: string;
    startDate?: string;
    endDate?: string;
  };

  // Actions
  setQuery: (query: string) => void;
  search: () => Promise<void>;
  searchByTag: (tag: string) => Promise<void>;
  searchByMood: (mood: string) => Promise<void>;
  clearSearch: () => void;
  setFilter: (key: string, value: string | undefined) => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  results: [],
  loading: false,
  error: null,
  filters: {},

  setQuery: (query: string) => set({ query }),

  search: async () => {
    const { query, filters } = get();
    if (!query.trim()) {
      set({ results: [], loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const results = await window.api.invoke('search:fullText', query, {
        limit: 20,
        ...filters,
      });
      set({ results, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  searchByTag: async (tag: string) => {
    set({ loading: true, error: null, query: `tag:${tag}` });
    try {
      const entries = await window.api.invoke('search:byTag', tag) as Entry[];
      set({
        results: entries.map(e => ({ entry: e, highlights: [], score: 0 })),
        loading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  searchByMood: async (mood: string) => {
    set({ loading: true, error: null, query: `mood:${mood}` });
    try {
      const entries = await window.api.invoke('search:byMood', mood) as Entry[];
      set({
        results: entries.map(e => ({ entry: e, highlights: [], score: 0 })),
        loading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  clearSearch: () => set({ query: '', results: [], error: null, filters: {} }),

  setFilter: (key: string, value: string | undefined) => {
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    }));
  },
}));
