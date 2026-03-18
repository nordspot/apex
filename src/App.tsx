import { useEffect } from 'react';
import { GameScene } from './three/RawScene';
import { HUD } from './components/HUD/HUD';
import { StartScreen } from './components/StartScreen';
import { Onboarding } from './components/Onboarding';
import { CompletionScreen } from './components/CompletionScreen';
import { initKeyboardInput, cleanupKeyboardInput } from './systems/InputManager';
import { useUIStore } from './stores/useUIStore';

let gameScene: GameScene | null = null;

function App() {
  const gamePhase = useUIStore((s) => s.gamePhase);

  useEffect(() => {
    initKeyboardInput();
    return cleanupKeyboardInput;
  }, []);

  useEffect(() => {
    if (gameScene) return;

    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    gameScene = new GameScene(canvas);
    gameScene.start();

    return () => {
      gameScene?.stop();
      gameScene = null;
    };
  }, []);

  return (
    <>
      {gamePhase === 'start' && <StartScreen />}
      {gamePhase === 'onboarding' && <Onboarding />}
      {gamePhase === 'playing' && <HUD />}
      {gamePhase === 'complete' && <CompletionScreen />}
    </>
  );
}

export default App;
