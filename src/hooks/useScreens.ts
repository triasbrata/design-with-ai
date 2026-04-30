import { useState, useEffect, useMemo, useCallback } from "react";
import type { Metadata } from "../types";
import { TIERS } from "../constants";

export function useScreens(dir: string, preloadedMetadata?: Metadata | null) {
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [currentScreen, setCurrentScreen] = useState("");

  // Fetch metadata — use preloaded (client project or FS handle) or fetch from server
  useEffect(() => {
    if (preloadedMetadata != null) {
      setMetadata(preloadedMetadata);
      return;
    }
    // Don't clear metadata here — keep showing previous screens until new data loads
    // (prevents a jarring flash of "no screens" in the left drawer when switching folders)
    if (!dir) return; // Skip fetch for empty dirs (FS handle mode or no dir configured)
    fetch(`/api/metadata?dir=${encodeURIComponent(dir)}`)
      .then((r) => r.json())
      .then(setMetadata)
      .catch(() =>
        setMetadata({
          meta: { version: "0", lastUpdated: "", totalScreens: 0 },
          screens: {},
          components: {},
        }),
      );
  }, [dir, preloadedMetadata]);

  // Compute ordered screen list from metadata
  const orderedScreens = useMemo(() => {
    if (!metadata) return [];
    const existing = Object.keys(metadata.screens);
    const result: string[] = [];
    for (const tier of Object.values(TIERS)) {
      for (const s of tier.screens) {
        if (existing.includes(s)) result.push(s);
      }
    }
    // Append any screens not in tiers
    const tiered = Object.values(TIERS).flatMap((t) => t.screens);
    for (const s of existing) {
      if (!tiered.includes(s)) result.push(s);
    }
    return result;
  }, [metadata]);

  const total = orderedScreens.length;
  const isSummary = currentIndex === -2;

  // Navigate to a screen by name, optionally preserving state
  const navigate = useCallback(
    (screen: string, state?: string) => {
      const params = new URLSearchParams();
      if (screen === "summary") {
        setCurrentIndex(-2);
        setCurrentScreen("");
        params.set("file", "summary");
      } else {
        const idx = orderedScreens.indexOf(screen);
        if (idx < 0) return;
        setCurrentIndex(idx);
        setCurrentScreen(screen);
        params.set("file", screen);
      }
      if (state) params.set("state", state);
      history.replaceState({}, "", `?${params.toString()}`);
    },
    [orderedScreens],
  );

  // Navigate by index
  const goTo = useCallback(
    (idx: number) => {
      if (idx === -2) {
        navigate("summary");
        return;
      }
      if (idx >= 0 && idx < orderedScreens.length) {
        navigate(orderedScreens[idx]);
      }
    },
    [orderedScreens, navigate],
  );

  const goNext = useCallback(() => {
    if (isSummary) return;
    if (currentIndex === orderedScreens.length - 1) {
      navigate("summary");
    } else {
      goTo(currentIndex + 1);
    }
  }, [currentIndex, orderedScreens.length, isSummary, navigate, goTo]);

  const goPrev = useCallback(() => {
    if (isSummary) {
      goTo(orderedScreens.length - 1);
    } else if (currentIndex > 0) {
      goTo(currentIndex - 1);
    }
  }, [currentIndex, orderedScreens.length, isSummary, goTo]);

  const goHome = useCallback(() => {
    if (orderedScreens.length > 0) {
      navigate(orderedScreens[0]);
    }
  }, [orderedScreens, navigate]);

  // Read initial state from URL (stable across renders via lazy useState init)
  const [queryState] = useState<string | undefined>(
    () => new URLSearchParams(location.search).get("state") || undefined,
  );

  // Read ?file= param on initial load (runs once orderedScreens populated)
  useEffect(() => {
    if (orderedScreens.length === 0) return;
    const params = new URLSearchParams(location.search);
    const fileParam = params.get("file");
    const stateParam = params.get("state") || undefined;
    if (fileParam === "summary") {
      navigate("summary", stateParam);
    } else if (fileParam && orderedScreens.includes(fileParam)) {
      navigate(fileParam, stateParam);
    } else {
      navigate(orderedScreens[0], stateParam);
    }
  }, [orderedScreens, navigate]);

  return {
    metadata,
    orderedScreens,
    currentIndex,
    currentScreen,
    total,
    isSummary,
    navigate,
    goTo,
    goNext,
    goPrev,
    goHome,
    queryState,
  };
}
