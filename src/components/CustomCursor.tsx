import { useEffect, useRef, useState } from 'react';

export default function CustomCursor() {
  const [visible, setVisible] = useState(false);
  const [clicking, setClicking] = useState(false);
  const dotRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!visible) setVisible(true);
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      }
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      }
    };

    const handleDown = () => setClicking(true);
    const handleUp = () => setClicking(false);
    const handleLeave = () => setVisible(false);
    const handleEnter = () => setVisible(true);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mousedown', handleDown);
    window.addEventListener('mouseup', handleUp);
    document.addEventListener('mouseleave', handleLeave);
    document.addEventListener('mouseenter', handleEnter);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('mouseup', handleUp);
      document.removeEventListener('mouseleave', handleLeave);
      document.removeEventListener('mouseenter', handleEnter);
    };
  }, [visible]);

  if (!visible) return null;

  const dotSize = clicking ? 5 : 8;
  const glowSize = clicking ? 24 : 36;

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 99999 }}>
      {/* Glow */}
      <div
        ref={glowRef}
        style={{
          position: 'absolute',
          left: -glowSize / 2,
          top: -glowSize / 2,
          width: glowSize,
          height: glowSize,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(232,212,77,${clicking ? 0.35 : 0.15}) 0%, transparent 70%)`,
          willChange: 'transform',
          transition: 'width 0.12s, height 0.12s, left 0.12s, top 0.12s',
        }}
      />
      {/* Dot */}
      <div
        ref={dotRef}
        style={{
          position: 'absolute',
          left: -dotSize / 2,
          top: -dotSize / 2,
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          backgroundColor: '#e8d44d',
          boxShadow: clicking
            ? '0 0 12px rgba(232,212,77,0.9), 0 0 24px rgba(232,212,77,0.5)'
            : '0 0 6px rgba(232,212,77,0.5)',
          willChange: 'transform',
          transition: 'width 0.08s, height 0.08s, left 0.08s, top 0.08s, box-shadow 0.08s',
        }}
      />
    </div>
  );
}
