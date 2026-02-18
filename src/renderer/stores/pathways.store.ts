import { create } from 'zustand';
import type { Pathway, Prompt } from '../../../shared/types';

interface PathwaysState {
  pathways: Pathway[];
  activePathway: Pathway | null;
  currentPrompt: Prompt | null;
  loading: boolean;
  error: string | null;

  loadPathways: () => Promise<void>;
  loadActivePathway: () => Promise<void>;
  activatePathway: (id: string) => Promise<Pathway>;
  deactivatePathway: (id: string) => Promise<void>;
  loadCurrentPrompt: (pathwayId: string) => Promise<Prompt | null>;
  completeDay: (pathwayId: string, entryId: string) => Promise<void>;
}

export const usePathwaysStore = create<PathwaysState>((set, get) => ({
  pathways: [],
  activePathway: null,
  currentPrompt: null,
  loading: false,
  error: null,

  loadPathways: async () => {
    set({ loading: true, error: null });
    try {
      const pathways = await window.api.invoke('pathways:list');
      set({ pathways, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  loadActivePathway: async () => {
    try {
      const activePathway = await window.api.invoke('pathways:getActive');
      set({ activePathway });
      if (activePathway) {
        const currentPrompt = await window.api.invoke('pathways:getCurrentPrompt', activePathway.id);
        set({ currentPrompt });
      } else {
        set({ currentPrompt: null });
      }
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  activatePathway: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const pathway = await window.api.invoke('pathways:activate', id);
      const currentPrompt = await window.api.invoke('pathways:getCurrentPrompt', id);
      set({
        activePathway: pathway,
        currentPrompt,
        loading: false,
      });
      return pathway;
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
      throw err;
    }
  },

  deactivatePathway: async (pathwayId: string) => {
    try {
      await window.api.invoke('pathways:deactivate', pathwayId);
      set({ activePathway: null, currentPrompt: null });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  loadCurrentPrompt: async (pathwayId: string) => {
    try {
      const currentPrompt = await window.api.invoke('pathways:getCurrentPrompt', pathwayId);
      set({ currentPrompt });
      return currentPrompt;
    } catch (err) {
      set({ error: (err as Error).message });
      return null;
    }
  },

  completeDay: async (pathwayId: string, entryId: string) => {
    try {
      await window.api.invoke('pathways:completeDay', pathwayId, entryId);
      await get().loadActivePathway();
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },
}));
