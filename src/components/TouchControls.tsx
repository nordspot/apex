import { useRef, useCallback } from 'react';
import { useInputStore } from '../systems/InputManager';
import { useUIStore } from '../stores/useUIStore';

const JOYSTICK_SIZE = 120;
const KNOB_SIZE = 48;
const ACTION_SIZE = 64;

const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;

export function TouchControls() {
  if (!isTouchDevice()) return null;

  return (
    <>
      <VirtualJoystick />
      <ActionButton />
    </>
  );
}

function VirtualJoystick() {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const touchIdRef = useRef<number | null>(null);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    const base = baseRef.current;
    const knob = knobRef.current;
    if (!base || !knob) return;

    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = JOYSTICK_SIZE / 2;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > radius) {
      dx = (dx / dist) * radius;
      dy = (dy / dist) * radius;
    }

    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    useInputStore.getState().setMove(dx / radius, -dy / radius);
  }, []);

  const handleEnd = useCallback(() => {
    touchIdRef.current = null;
    const knob = knobRef.current;
    if (knob) knob.style.transform = 'translate(0px, 0px)';
    useInputStore.getState().setMove(0, 0);
  }, []);

  return (
    <div
      ref={baseRef}
      style={{
        position: 'absolute',
        bottom: 40,
        left: 30,
        width: JOYSTICK_SIZE,
        height: JOYSTICK_SIZE,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.12)',
        border: '2px solid rgba(255,255,255,0.25)',
        pointerEvents: 'auto',
        touchAction: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onTouchStart={(e) => {
        if (touchIdRef.current !== null) return;
        const touch = e.changedTouches[0];
        touchIdRef.current = touch.identifier;
        handleMove(touch.clientX, touch.clientY);
      }}
      onTouchMove={(e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === touchIdRef.current) {
            handleMove(touch.clientX, touch.clientY);
            break;
          }
        }
      }}
      onTouchEnd={(e) => {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === touchIdRef.current) {
            handleEnd();
            break;
          }
        }
      }}
      onTouchCancel={handleEnd}
    >
      <div
        ref={knobRef}
        style={{
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.35)',
          border: '2px solid rgba(255,255,255,0.5)',
          transition: 'none',
        }}
      />
    </div>
  );
}

function ActionButton() {
  const prompt = useUIStore((s) => s.interactionPrompt);
  const hasAction = !!prompt;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 60,
        right: 30,
        width: ACTION_SIZE,
        height: ACTION_SIZE,
        borderRadius: '50%',
        background: hasAction ? 'rgba(0, 120, 255, 0.6)' : 'rgba(255,255,255,0.1)',
        border: `2px solid ${hasAction ? 'rgba(77, 194, 255, 0.8)' : 'rgba(255,255,255,0.2)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: 20,
        fontWeight: 700,
        pointerEvents: 'auto',
        touchAction: 'none',
        transition: 'background 0.2s, border-color 0.2s',
        boxShadow: hasAction ? '0 0 20px rgba(0,150,255,0.4)' : 'none',
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        useInputStore.getState().setInteract(true);
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        useInputStore.getState().setInteract(false);
      }}
    >
      E
    </div>
  );
}
