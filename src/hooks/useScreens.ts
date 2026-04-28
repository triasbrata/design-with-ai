import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Metadata } from '../types';
import { TIERS } from '../constants';

export function useScreens() {
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [currentScreen, setCurrentScreen] = useState('');

  // Fetch metadata
  useEffect(() => {
    fetch('/screens/screen-metadata.json')
      .then((r) => r.json())
      .then(setMetadata)
      .catch(() => setMetadata({ meta: { version: '0', lastUpdated: '', totalScreens: 0 }, screens: {}, components: {} }));
  }, []);

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

  // Navigate to a screen by name
  const navigate = useCallback(
    (screen: string) => {
      if (screen === 'summary') {
        setCurrentIndex(-2);
        setCurrentScreen('');
        history.replaceState({}, '', '?file=summary');
        return;
      }
      const idx = orderedScreens.indexOf(screen);
      if (idx >= 0) {
        setCurrentIndex(idx);
        setCurrentScreen(screen);
        history.replaceState({}, '', `?file=${screen}`);
      }
    },
    [orderedScreens]
  );

  // Navigate by index
  const goTo = useCallback(
    (idx: number) => {
      if (idx === -2) {
        navigate('summary');
        return;
      }
      if (idx >= 0 && idx < orderedScreens.length) {
        navigate(orderedScreens[idx]);
      }
    },
    [orderedScreens, navigate]
  );

  const goNext = useCallback(() => {
    if (isSummary) return;
    if (currentIndex === orderedScreens.length - 1) {
      navigate('summary');
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

  // Read ?file= param on initial load
  useEffect(() => {
    if (orderedScreens.length === 0) return;
    const params = new URLSearchParams(location.search);
    const fileParam = params.get('file');
    if (fileParam === 'summary') {
      navigate('summary');
    } else if (fileParam && orderedScreens.includes(fileParam)) {
      navigate(fileParam);
    } else {
      navigate(orderedScreens[0]);
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
  };
}
