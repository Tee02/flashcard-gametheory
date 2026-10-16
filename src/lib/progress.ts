import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Grade = "again" | "hard" | "good";

export type Stat = {
  box: 0 | 1 | 2 | 3;
  reviews: number;
  lapses: number;
};

type ProgressState = {
  stats: Record<string, Stat>;
  grade: (id: string, g: Grade) => void;
  reset: () => void;
};

function empty(): Stat {
  return { box: 0, reviews: 0, lapses: 0 };
}

export function nextBox(box: Stat["box"], g: Grade): Stat["box"] {
  if (g === "again") return 0;
  if (g === "hard") return 1;
  return Math.min(3, Math.max(2, box + 1)) as Stat["box"];
}

export const boxLabel = ["未学", "含糊", "熟悉", "掌握"] as const;

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      stats: {},
      grade: (id, g) =>
        set((state) => {
          const prev = state.stats[id] ?? empty();
          const box = nextBox(prev.box, g);
          return {
            stats: {
              ...state.stats,
              [id]: {
                box,
                reviews: prev.reviews + 1,
                lapses: prev.lapses + (g === "again" ? 1 : 0),
              },
            },
          };
        }),
      reset: () => set({ stats: {} }),
    }),
    { name: "boyi-flash", skipHydration: true },
  ),
);
