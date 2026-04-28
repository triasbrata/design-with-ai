import { useState, useCallback } from "react";
import type { ProjectConfig } from "../types";

const STORAGE_KEY = "golden-review.projects.v1";
const ACTIVE_KEY = "golden-review.active-project.v1";

const DEFAULT_PROJECTS: ProjectConfig[] = [
  { name: "MoneyKitty", dir: "../../docs/moneykitty/design/golden/" },
];

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectConfig[]>(() =>
    loadFromStorage(STORAGE_KEY, DEFAULT_PROJECTS),
  );
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    loadFromStorage(ACTIVE_KEY, 0),
  );

  const activeProject = projects[activeIndex] ?? projects[0];

  const persistProjects = useCallback((next: ProjectConfig[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setProjects(next);
  }, []);

  const addProject = useCallback(
    (name: string, dir: string) => {
      const next = [...projects, { name, dir }];
      persistProjects(next);
    },
    [projects, persistProjects],
  );

  const removeProject = useCallback(
    (index: number) => {
      if (projects.length <= 1) return;
      const next = projects.filter((_, i) => i !== index);
      persistProjects(next);
      setActiveIndex((prev) => {
        if (prev >= next.length) {
          const adjusted = Math.max(0, next.length - 1);
          localStorage.setItem(ACTIVE_KEY, String(adjusted));
          return adjusted;
        }
        if (prev > index) {
          const adjusted = prev - 1;
          localStorage.setItem(ACTIVE_KEY, String(adjusted));
          return adjusted;
        }
        return prev;
      });
    },
    [projects, persistProjects],
  );

  const setActive = useCallback((index: number) => {
    setActiveIndex(index);
    localStorage.setItem(ACTIVE_KEY, String(index));
  }, []);

  return { projects, activeIndex, activeProject, addProject, removeProject, setActive };
}
