import { useEffect, useRef, useState } from 'react';

interface GameProps {
  onGameOver: (result: "win" | "fail", coins: number) => void;
}

const CyberGame = ({ onGameOver }: GameProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [coins, setCoins] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60); 
  const [gameActive, setGameActive] = useState(true);

  // GAME CONSTANTS
  const GRAVITY = 0.6;
  const JUMP_STRENGTH = -12;
  const SPEED_START = 6; 
  const FLOOR_OFFSET = 50; 

  // IMAGES
  const playerImg = useRef(new Image());
  const bgImg = useRef(new Image());
  const coinImg = useRef(new Image());

  // --- 1. NEW: Handle Win Condition Safely ---
  // We watch [timeLeft]. When it hits 0, we trigger win.
  useEffect(() => {
    if (timeLeft === 0 && gameActive) {
        setGameActive(false);
        onGameOver("win", coins);
    }
  }, [timeLeft, gameActive, coins, onGameOver]);

  useEffect(() => {
    // Load Images
    playerImg.current.src = "/player.png"; 
    bgImg.current.src = "/bg.png";         
    coinImg.current.src = "/coin.png";     

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize Logic
    const handleResize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // Game State
    const gameState = {
      playerY: 0, 
      velocity: 0,
      isJumping: false,
      speed: SPEED_START,
      bgX: 0, 
      obstacles: [] as { x: number, type: 'wall', passed: boolean }[],
      gameCoins: [] as { x: number, y: number, collected: boolean }[],
      frameCount: 0
    };

    gameState.playerY = canvas.height - FLOOR_OFFSET - 80;

    let animationId: number;

    const spawnEntity = () => {
      const floorY = canvas.height - FLOOR_OFFSET;
      // Coins
      if (Math.random() < 0.05) {
        gameState.gameCoins.push({ 
            x: canvas.width + 100, 
            y: (floorY - 150) + Math.random() * 100, 
            collected: false 
        });
      }
      // Obstacles
      if (gameState.frameCount > 100 && Math.random() < 0.02) {
        const lastObstacle = gameState.obstacles[gameState.obstacles.length - 1];
        if (!lastObstacle || (canvas.width - lastObstacle.x > 400)) {
            gameState.obstacles.push({ x: canvas.width + 50, type: 'wall', passed: false });
        }
      }
    };

    const update = () => {
      if (!gameActive) return;
      gameState.frameCount++;

      const currentFloorY = canvas.height - FLOOR_OFFSET;

      // Difficulty
      if (gameState.frameCount % 600 === 0) gameState.speed += 0.5;

      // Physics
      gameState.velocity += GRAVITY;
      gameState.playerY += gameState.velocity;

      if (gameState.playerY >= currentFloorY - 80) { 
        gameState.playerY = currentFloorY - 80;
        gameState.isJumping = false;
        gameState.velocity = 0;
      }

      // Move World
      gameState.bgX -= gameState.speed * 0.2; 
      if (gameState.bgX <= -1920) gameState.bgX = 0; 

      gameState.obstacles.forEach(o => o.x -= gameState.speed);
      gameState.gameCoins.forEach(c => c.x -= gameState.speed);

      // Cleanup
      gameState.obstacles = gameState.obstacles.filter(o => o.x > -100);
      gameState.gameCoins = gameState.gameCoins.filter(c => c.x > -50);

      spawnEntity();

      // Collision
      const playerRect = { x: 100, y: gameState.playerY + 10, w: 40, h: 60 };

      for (const obs of gameState.obstacles) {
        const obsRect = { x: obs.x + 10, y: currentFloorY - 80, w: 30, h: 80 }; 
        if (
            playerRect.x < obsRect.x + obsRect.w &&
            playerRect.x + playerRect.w > obsRect.x &&
            playerRect.y < obsRect.y + obsRect.h &&
            playerRect.h + playerRect.y > obsRect.y
        ) {
            // CRASH LOGIC
            setGameActive(false);
            onGameOver("fail", coins); 
            return;
        }
      }

      gameState.gameCoins.forEach(coin => {
        if (!coin.collected) {
            const coinRect = { x: coin.x, y: coin.y, w: 40, h: 40 };
            if (
                playerRect.x < coinRect.x + coinRect.w &&
                playerRect.x + playerRect.w > coinRect.x &&
                playerRect.y < coinRect.y + coinRect.h &&
                playerRect.h + playerRect.y > coinRect.y
            ) {
                coin.collected = true;
                setCoins(prev => prev + 1);
            }
        }
      });

      draw(ctx, gameState, canvas.width, canvas.height);
      animationId = requestAnimationFrame(update);
    };

    const draw = (ctx: CanvasRenderingContext2D, state: any, w: number, h: number) => {
      const floorY = h - FLOOR_OFFSET;

      // 1. Draw Background
      ctx.fillStyle = '#0f0e17';
      ctx.fillRect(0, 0, w, h);

      if (bgImg.current.complete && bgImg.current.naturalWidth > 0) {
          const bgW = 1920; 
          ctx.drawImage(bgImg.current, state.bgX, 0, bgW, h); 
          ctx.drawImage(bgImg.current, state.bgX + bgW, 0, bgW, h);
          ctx.drawImage(bgImg.current, state.bgX + (bgW * 2), 0, bgW, h);
      } 

      // 2. Draw Floor
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00fff5';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, floorY, w, FLOOR_OFFSET); 
      
      ctx.strokeStyle = '#00fff5';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, floorY);
      ctx.lineTo(w, floorY);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 3. Draw Player
      if (playerImg.current.complete && playerImg.current.naturalWidth > 0) {
        ctx.drawImage(playerImg.current, 100, state.playerY, 60, 90);
      } else {
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(100, state.playerY, 50, 80);
      }

      // 4. Draw Obstacles
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ff2e63';
      ctx.fillStyle = '#ff2e63';
      state.obstacles.forEach((obs: any) => {
          ctx.fillRect(obs.x, floorY - 80, 50, 80); 
      });
      ctx.shadowBlur = 0;

      // 5. Draw Coins
      state.gameCoins.forEach((coin: any) => {
        if (!coin.collected) {
           if (coinImg.current.complete && coinImg.current.naturalWidth > 0) {
               ctx.drawImage(coinImg.current, coin.x, coin.y, 40, 40);
           } else {
               ctx.beginPath();
               ctx.fillStyle = '#f9bc60';
               ctx.arc(coin.x + 20, coin.y + 20, 15, 0, Math.PI * 2);
               ctx.fill();
           }
        }
      });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
          e.preventDefault(); 
          if (!gameState.isJumping) {
            gameState.velocity = JUMP_STRENGTH;
            gameState.isJumping = true;
          }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    animationId = requestAnimationFrame(update);

    // --- 2. NEW: Clean Timer Logic ---
    const timerInterval = setInterval(() => {
        if (!gameActive) return;
        setTimeLeft((prev) => {
            if (prev <= 0) return 0;
            return prev - 1;
        });
    }, 1000);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      clearInterval(timerInterval);
    };
  }, [gameActive]); // Re-run effect if gameActive changes

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', overflow: 'hidden', background: '#000', zIndex: 9999 }}>
      <div style={{ position: 'absolute', top: 20, left: 20, color: '#00fff5', fontFamily: 'monospace', fontSize: '1.5rem', zIndex: 10, textShadow: '0 0 5px #00fff5', background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '8px' }}>
        <div>TIME: {timeLeft}s</div>
        <div>COINS: {coins}</div>
      </div>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      <div style={{ position: 'absolute', bottom: 20, width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', zIndex: 10 }}>
        PRESS SPACE TO JUMP
      </div>
    </div>
  );
};

export default CyberGame;