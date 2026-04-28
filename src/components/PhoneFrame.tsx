import { forwardRef, useImperativeHandle, useRef } from "react";
import { MarkerOverlay } from "./MarkerOverlay";
import type { Marker, MarkerContext } from "../types";

interface PhoneFrameProps {
  src: string;
  onLoad: () => void;
  screen: string;
  markingEnabled: boolean;
  markers: Marker[];
  onMarkerCreate: (ctx: MarkerContext) => void;
  onRemoveMarker: (id: string) => void;
  onToggleMarking: () => void;
}

export const PhoneFrame = forwardRef<
  { getIframe: () => HTMLIFrameElement | null },
  PhoneFrameProps
>(function PhoneFrame(
  {
    src,
    onLoad,
    screen,
    markingEnabled,
    markers,
    onMarkerCreate,
    onRemoveMarker,
    onToggleMarking,
  },
  ref,
) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useImperativeHandle(ref, () => ({
    getIframe: () => iframeRef.current,
  }));

  return (
    <div className="frame-wrapper" style={{ position: "relative" }}>
      <iframe
        ref={iframeRef}
        src={src}
        sandbox="allow-scripts allow-same-origin"
        id="phone-frame"
        onLoad={onLoad}
        title="Phone preview"
        style={{ pointerEvents: markingEnabled ? "none" : "auto" }}
      />
      <MarkerOverlay
        getIframe={() => iframeRef.current}
        screen={screen}
        enabled={markingEnabled}
        markers={markers}
        onMarkerCreate={onMarkerCreate}
        onRemoveMarker={onRemoveMarker}
      />
      {/* Marker toggle button */}
      <button
        className={`marker-tool-btn${markingEnabled ? " active" : ""}`}
        onClick={onToggleMarking}
        title={markingEnabled ? "Stop marking (M)" : "Mark area (M)"}
      >
        {markingEnabled ? "Done" : "Mark"}
      </button>
    </div>
  );
});
