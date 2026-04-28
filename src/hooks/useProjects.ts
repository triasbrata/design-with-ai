import { useState, useCallback } from "react";
import type { Project, Workspace, ClientProject, CaptureFolder } from "../types";

const STORAGE_KEY = "golden-review.workspaces.v2";
const ACTIVE_KEY = "golden-review.active-project.v1";

const DEFAULT_PROJECTS: Project[] = [
  {
    type: "workspace",
    name: "MoneyKitty",
    activeFolder: 0,
    folders: [
      {
        name: "Main Screens",
        inputDir: "../../docs/moneykitty/design/golden/",
        outputDir: "../../docs/moneykitty/design/golden/",
      },
    ],
  },
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

  // Derive active folder info from active project
  const activeFolder: CaptureFolder | null =
    activeProject?.type === "workspace"
      ? activeProject.folders[activeProject.activeFolder] ?? activeProject.folders[0] ?? null
      : null;

  const activeInputDir = activeFolder?.inputDir ?? "";
  const activeOutputDir = activeFolder?.outputDir ?? activeFolder?.inputDir ?? "";

  /** Persist workspace projects to localStorage */
  const persist = useCallback((allProjects: Project[]) => {
    const workspaces = allProjects.filter(
      (p): p is Workspace => p.type === "workspace",
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
    setProjects(allProjects);
  }, []);

  const addProject = useCallback(
    (project: Project) => {
      const next = [...projects, project];
      if (project.type === "workspace") {
        persist(next);
      } else {
        // Client projects: in-memory only
        setProjects(next);
      }
    },
    [projects, persist],
  );

  const addFolderToWorkspace = useCallback(
    (workspaceIdx: number, folder: CaptureFolder) => {
      setProjects((prev) => {
        const next = prev.map((p, i) => {
          if (i === workspaceIdx && p.type === "workspace") {
            return { ...p, folders: [...p.folders, folder] };
          }
          return p;
        });
        const workspaces = next.filter(
          (p): p is Workspace => p.type === "workspace",
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
        return next;
      });
    },
    [],
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
      persist(next);
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
    [projects, persist],
  );

  /** Remove a folder from a workspace. Deletes workspace if last folder removed. */
  const removeFolder = useCallback(
    (projectIdx: number, folderIdx: number) => {
      setProjects((prev) => {
        const project = prev[projectIdx];
        if (!project || project.type !== "workspace") return prev;

        if (project.folders.length <= 1) {
          // Remove the whole workspace
          const next = prev.filter((_, i) => i !== projectIdx);
          const workspaces = next.filter(
            (p): p is Workspace => p.type === "workspace",
          );
          localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
          setActiveIndex((a) => {
            if (a >= next.length) return Math.max(0, next.length - 1);
            if (a > projectIdx) return a - 1;
            return a;
          });
          return next;
        }

        // Remove folder, adjust activeFolder if needed
        const next = prev.map((p, i) => {
          if (i !== projectIdx || p.type !== "workspace") return p;
          const newFolders = p.folders.filter((_, fi) => fi !== folderIdx);
          const newActive = p.activeFolder >= newFolders.length
            ? newFolders.length - 1
            : p.activeFolder > folderIdx
              ? p.activeFolder - 1
              : p.activeFolder === folderIdx
                ? Math.max(0, folderIdx - 1)
                : p.activeFolder;
          return { ...p, folders: newFolders, activeFolder: newActive };
        });
        const workspaces = next.filter(
          (p): p is Workspace => p.type === "workspace",
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
        return next;
      });
    },
    [],
  );

  const setActive = useCallback(
    (index: number, folderIdx?: number) => {
      setActiveIndex(index);
      localStorage.setItem(ACTIVE_KEY, String(index));

      if (folderIdx !== undefined) {
        setProjects((prev) => {
          const next = prev.map((p, i) => {
            if (i === index && p.type === "workspace") {
              return { ...p, activeFolder: folderIdx };
            }
            return p;
          });
          const workspaces = next.filter(
            (p): p is Workspace => p.type === "workspace",
          );
          localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
          return next;
        });
      }
    },
    [],
  );

  return {
    projects,
    activeIndex,
    activeProject,
    activeFolder,
    activeInputDir,
    activeOutputDir,
    addProject,
    addFolderToWorkspace,
    removeProject,
    removeFolder,
    setActive,
  };
}
