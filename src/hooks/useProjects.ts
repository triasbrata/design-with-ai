import { useState, useCallback } from "react";
import type { Project, ServerProject, ClientProject } from "../types";

const STORAGE_KEY = "golden-review.projects.v1";
const ACTIVE_KEY = "golden-review.active-project.v1";

const DEFAULT_PROJECTS: Project[] = [
  { type: "server", name: "MoneyKitty", dir: "../../docs/moneykitty/design/golden/" },
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
  const [projects, setProjects] = useState<Project[]>(() =>
    loadFromStorage(STORAGE_KEY, DEFAULT_PROJECTS),
  );
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    loadFromStorage(ACTIVE_KEY, 0),
  );

  const activeProject = projects[activeIndex] ?? projects[0];

  /** Persist only ServerProject entries to localStorage */
  const persistServerProjects = useCallback((allProjects: Project[]) => {
    const serverProjects = allProjects.filter(
      (p): p is ServerProject => p.type === "server",
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serverProjects));
    setProjects(allProjects);
  }, []);

  const addProject = useCallback(
    (project: Project) => {
      const next = [...projects, project];
      if (project.type === "server") {
        persistServerProjects(next);
      } else {
        // Client projects: in-memory only (files can't be serialized)
        setProjects(next);
      }
    },
    [projects, persistServerProjects],
  );

  const removeProject = useCallback(
    (index: number) => {
      if (projects.length <= 1) return;

      // Revoke blob URLs for client projects
      const removed = projects[index];
      if (removed?.type === "client") {
        removed.files.forEach((f) => URL.revokeObjectURL(f.blobUrl));
      }

      const next = projects.filter((_, i) => i !== index);
      persistServerProjects(next);
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
    [projects, persistServerProjects],
  );

  const setActive = useCallback((index: number) => {
    setActiveIndex(index);
    localStorage.setItem(ACTIVE_KEY, String(index));
  }, []);

  return { projects, activeIndex, activeProject, addProject, removeProject, setActive };
}
