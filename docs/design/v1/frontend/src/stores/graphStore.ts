import { create } from 'zustand';

interface GraphState {
  selectedNodeId: string | null;
  highlightNodeId: string | null;
  searchQuery: string;
  minSimilarity: number;
  maxEdges: number;
  categoryFilter: string | null;
  zoomLevel: number;
  selectNode: (nodeId: string | null) => void;
  highlightNode: (nodeId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setMinSimilarity: (value: number) => void;
  setMaxEdges: (value: number) => void;
  setCategoryFilter: (categoryId: string | null) => void;
  setZoomLevel: (level: number) => void;
  resetView: () => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  selectedNodeId: null,
  highlightNodeId: null,
  searchQuery: '',
  minSimilarity: 0.1,
  maxEdges: 500,
  categoryFilter: null,
  zoomLevel: 1.0,

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  highlightNode: (nodeId) => set({ highlightNodeId: nodeId }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setMinSimilarity: (value) =>
    set({ minSimilarity: Math.max(0, Math.min(1, value)) }),
  setMaxEdges: (value) => set({ maxEdges: Math.max(10, Math.min(2000, value)) }),
  setCategoryFilter: (categoryId) => set({ categoryFilter: categoryId }),
  setZoomLevel: (level) => set({ zoomLevel: level }),

  resetView: () =>
    set({
      selectedNodeId: null,
      highlightNodeId: null,
      searchQuery: '',
      zoomLevel: 1.0,
    }),
}));
