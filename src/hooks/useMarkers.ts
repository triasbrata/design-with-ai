import { useState, useCallback } from "react";
import type { Marker, MarkerContext } from "../types";

const PALETTE = ["#C45353", "#4A90D9", "#50B86C", "#F5A623", "#9B59B6"];
let colorIdx = 0;

export function useMarkers() {
  const [markers, setMarkers] = useState<Marker[]>([]);

  const addMarker = useCallback((ctx: MarkerContext) => {
    const color = PALETTE[colorIdx % PALETTE.length];
    colorIdx++;
    setMarkers((prev) => [...prev, { ...ctx, color }]);
  }, []);

  const removeMarker = useCallback((id: string) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clearMarkers = useCallback(() => {
    setMarkers([]);
  }, []);

  return { markers, addMarker, removeMarker, clearMarkers };
}
