import { forwardRef, useImperativeHandle, useRef } from 'react';

interface PhoneFrameProps {
  src: string;
  onLoad: () => void;
}

export const PhoneFrame = forwardRef<{ getIframe: () => HTMLIFrameElement | null }, PhoneFrameProps>(
  function PhoneFrame({ src, onLoad }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useImperativeHandle(ref, () => ({
      getIframe: () => iframeRef.current,
    }));

    return (
      <div className="frame-wrapper">
        <iframe
          ref={iframeRef}
          src={src}
          sandbox="allow-scripts allow-same-origin"
          id="phone-frame"
          onLoad={onLoad}
          title="Phone preview"
        />
      </div>
    );
  },
);
