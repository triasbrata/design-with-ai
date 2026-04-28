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
      <div className="frame-wrapper" style={{ width: `${width}px`, height: `${height}px` }}>
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
