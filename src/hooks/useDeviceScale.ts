import { useState, useEffect, useCallback, type RefObject } from 'react';
import { DEVICE_PRESETS, type DeviceMode } from '../constants';

export function useDeviceScale(
  containerRef: RefObject<HTMLDivElement | null>,
  deviceMode: DeviceMode,
) {
  const [scale, setScale] = useState(1);
  const [logicalW, setLogicalW] = useState(390);
  const [logicalH, setLogicalH] = useState(844);

  const recalc = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const preset = DEVICE_PRESETS[deviceMode];
    const logicalWidth = preset.width;
    const logicalHeight = preset.height;
    setLogicalW(logicalWidth);
    setLogicalH(logicalHeight);

    const padding = 48;
    const availW = container.clientWidth - padding;
    const availH = container.clientHeight - padding;

    const scaleX = availW / logicalWidth;
    const scaleY = availH / logicalHeight;
    const s = Math.min(scaleX, scaleY, 1);

    setScale(s);
  }, [containerRef, deviceMode]);

  useEffect(() => {
    recalc();
    const observer = new ResizeObserver(recalc);
    const container = containerRef.current;
    if (container) observer.observe(container);
    window.addEventListener('resize', recalc);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recalc);
    };
  }, [recalc, containerRef]);

  return { scale, logicalW, logicalH };
}
