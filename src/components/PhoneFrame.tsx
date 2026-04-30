import { forwardRef, useImperativeHandle, useRef } from 'react';

interface PhoneFrameProps {
  src: string;
  onLoad: () => void;
  width: number;
  height: number;
}

export const PhoneFrame = forwardRef<{ getIframe: () => HTMLIFrameElement | null }, PhoneFrameProps>(
  function PhoneFrame({ src, onLoad, width, height }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useImperativeHandle(ref, () => ({
      getIframe: () => iframeRef.current,
    }));

    return (
      <div
        data-caid="phone-frame"
        className="shrink-0 rounded-[28px] shadow-brand-lg overflow-hidden bg-white"
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        {/*
          sandbox="allow-scripts allow-same-origin" is required:
          - allow-scripts: enables the spec HTML to run its baseline contract JS
          - allow-same-origin: needed for postMessage communication between
            the parent viewer and the spec HTML (setState contract).
            Without allow-same-origin, the iframe's contentWindow is null,
            breaking the entire state-switching mechanism.
        */}
        <iframe
          ref={iframeRef}
          src={src}
          sandbox="allow-scripts allow-same-origin"
          id="phone-frame"
          onLoad={onLoad}
          title="Phone preview"
          style={{ width: `${width}px`, height: `${height}px`, border: 'none', display: 'block' }}
        />
      </div>
    );
  },
);
