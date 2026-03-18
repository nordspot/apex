import { useEffect } from 'react';
import { GameScene } from './three/RawScene';
import { HUD } from './components/HUD/HUD';
import { initKeyboardInput, cleanupKeyboardInput } from './systems/InputManager';

let gameScene: GameScene | null = null;

function App() {
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

  return <HUD />;
}

export default App;
