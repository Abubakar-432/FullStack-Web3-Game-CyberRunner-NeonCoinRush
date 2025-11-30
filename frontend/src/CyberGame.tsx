import { useEffect, useRef, useState } from 'react';

interface GameProps {
  onGameOver: (result: "win" | "fail", coins: number) => void;
  hasMagnet: boolean; 
  hasShield: boolean; 
  hasNFT: boolean;    
}

const CyberGame = ({ onGameOver, hasMagnet, hasShield, hasNFT }: GameProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [coins, setCoins] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60); 
  const [gameActive, setGameActive] = useState(true);
  
  // --- VISUAL STATE ---
  const [shieldVisual, setShieldVisual] = useState(hasShield);

  // --- LOGIC REFS ---
  const shieldRef = useRef(hasShield);
  const magnetRef = useRef(hasMagnet);
  const nftRef = useRef(hasNFT);
  const shieldBrokenRef = useRef(false);

  // Sync refs/state when props change
  useEffect(() => { 
    if (!shieldBrokenRef.current) {
        shieldRef.current = hasShield; 
        setShieldVisual(hasShield); 
    }
  }, [hasShield]);
  
  useEffect(() => { magnetRef.current = hasMagnet; }, [hasMagnet]);
  useEffect(() => { nftRef.current = hasNFT; }, [hasNFT]);

  // GAME CONSTANTS
  const NORMAL_GRAVITY = 0.6;
  const HOVER_GRAVITY = 0.4; 
  const NORMAL_JUMP_STRENGTH = -15;
  const HOVER_JUMP_STRENGTH = -13; 
  const SPEED_START = 6; 
  const HOVER_SPEED_START = 8;
  const FLOOR_OFFSET = 50; 
  const PLAYER_HEIGHT = 120; 
  const PLAYER_WIDTH = 60;

  const SINK_OFFSET = 8.5; // CHANGED: was 15, now 0 so player is higher (not inside ground)

  const OBSTACLE_WIDTH = 122;
  const OBSTACLE_HEIGHT = 175;
  const HOVER_OFFSET = 0;

  const OBSTACLE_Y_OFFSET = 50; // CHANGED: extra drop so fence sits on ground

  // --- IMAGES ---
  const playerRunSheet1 = useRef(new Image()); 
  const playerRunSheet2 = useRef(new Image()); 
  const playerJumpImg = useRef(new Image());
  const hoverboardSheet1 = useRef(new Image());
  const hoverboardSheet2 = useRef(new Image());
  const bgImg = useRef(new Image());
  const coinImg = useRef(new Image());
  const obstacleImg = useRef(new Image());

  useEffect(() => {
    if (timeLeft === 0 && gameActive) {
        setGameActive(false);
        onGameOver("win", coins);
    }
  }, [timeLeft, gameActive, coins, onGameOver]);

  useEffect(() => {
    // 1. LOAD IMAGES
    playerRunSheet1.current.src = "/player1.png"; 
    playerRunSheet2.current.src = "/player2.png"; 
    playerJumpImg.current.src = "/jump.png";
    hoverboardSheet1.current.src = "/hoverboard1.png"; 
    hoverboardSheet2.current.src = "/hoverboard2.png"; 
    bgImg.current.src = "/bg.png";         
    coinImg.current.src = "/coin.png";     
    obstacleImg.current.src = "/obstacle.png"; 

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    // Game State
    const gameState = {
      playerY: canvas.height - FLOOR_OFFSET + SINK_OFFSET, 
      velocity: 0,
      isJumping: false,
      speed: nftRef.current ? HOVER_SPEED_START : SPEED_START,
      bgX: 0, 
      obstacles: [] as { x: number, y: number, w: number, h: number, type: 'wall' | 'platform', passed: boolean }[],
      gameCoins: [] as { x: number, y: number, collected: boolean }[],
      frameCount: 0,
      hoverOffset: 0
    };

    let animationId: number;

    const spawnEntity = () => {
      const floorY = canvas.height - FLOOR_OFFSET;
      
      if (gameState.frameCount > 100 && Math.random() < 0.02) {
        const lastObs = gameState.obstacles[gameState.obstacles.length - 1];
        if (!lastObs || (canvas.width - lastObs.x > 450)) {
            const type = Math.random() > 0.5 ? 'platform' : 'wall';
            
            if (type === 'wall') {
                gameState.obstacles.push({ 
                    x: canvas.width + 50, 
                    y: floorY - OBSTACLE_HEIGHT + OBSTACLE_Y_OFFSET, // CHANGED: use offset
                    w: OBSTACLE_WIDTH, 
                    h: OBSTACLE_HEIGHT,            
                    type: 'wall', passed: false 
                });
            } else {
                gameState.obstacles.push({ 
                    x: canvas.width + 50, 
                    y: floorY - 140, 
                    w: 150, h: 20,   
                    type: 'platform', passed: false 
                });
            }
        }
      }

      if (Math.random() < 0.04) {
        const lastObs = gameState.obstacles[gameState.obstacles.length - 1];
        let coinX = canvas.width + 100;
        let coinY = floorY - 150 + Math.random() * 50; 

        if (lastObs && lastObs.type === 'platform' && lastObs.x > canvas.width - 150) {
             coinX = lastObs.x + (Math.random() * lastObs.w); 
             coinY = lastObs.y - 60; 
        } 
        else if (lastObs && lastObs.type === 'wall' && Math.abs(lastObs.x - coinX) < 60) {
             coinY = floorY - 160; 
        }

        gameState.gameCoins.push({ x: coinX, y: coinY, collected: false });
      }
    };

    const update = () => {
      if (!gameActive) return;
      gameState.frameCount++;

      const currentFloorY = canvas.height - FLOOR_OFFSET;

      if (gameState.frameCount % 600 === 0) gameState.speed += 0.5;

      // Gravity
      const gravity = nftRef.current ? HOVER_GRAVITY : NORMAL_GRAVITY;
      
      gameState.velocity += gravity;
      gameState.playerY += gameState.velocity;

      const playerX = 100;
      const playerWidth = PLAYER_WIDTH;
      gameState.hoverOffset = nftRef.current ? HOVER_OFFSET : 0;

      // Floor
      const floorLevel = currentFloorY + SINK_OFFSET - gameState.hoverOffset;
      if (gameState.playerY >= floorLevel) { 
        gameState.playerY = floorLevel;
        gameState.isJumping = false;
        gameState.velocity = 0;
      }

      // Platforms
      if (gameState.velocity > 0) {
          for (const obs of gameState.obstacles) {
              if (obs.type === 'platform') {
                  if (playerX + playerWidth > obs.x && playerX < obs.x + obs.w) {
                      const tolerance = 25;
                      const platformLevel = obs.y + SINK_OFFSET - gameState.hoverOffset;
                      if (gameState.playerY >= obs.y - gameState.hoverOffset && gameState.playerY <= obs.y + tolerance - gameState.hoverOffset) {
                          gameState.playerY = platformLevel; 
                          gameState.isJumping = false;
                          gameState.velocity = 0;
                      }
                  }
              }
          }
      }

      // Move world
      gameState.bgX -= gameState.speed * 0.2;
      if (gameState.bgX <= -1920) gameState.bgX = 0;

      gameState.obstacles.forEach(o => o.x -= gameState.speed);
      gameState.gameCoins.forEach(c => c.x -= gameState.speed);

      gameState.obstacles = gameState.obstacles.filter(o => o.x > -150);
      gameState.gameCoins = gameState.gameCoins.filter(c => !c.collected && c.x > -50);

      spawnEntity();

      // Hitbox
      const hitbox = { 
          x: playerX + 10, 
          y: gameState.playerY - 80, 
          w: 40, 
          h: 60 
      };

      // Collision
      for (const obs of gameState.obstacles) {
        if (obs.type === 'wall' && !obs.passed) {
            if (
                hitbox.x < obs.x + obs.w &&
                hitbox.x + hitbox.w > obs.x &&
                hitbox.y < obs.y + obs.h &&
                hitbox.y + hitbox.h > obs.y
            ) {
                if (shieldRef.current) {
                   shieldRef.current = false; 
                   shieldBrokenRef.current = true;
                   setShieldVisual(false);
                   obs.passed = true;
                } else {
                   setGameActive(false);
                   onGameOver("fail", coins); 
                   return;
                }
            }
        }
      }

      // Magnet Logic
      gameState.gameCoins.forEach(coin => {
        if (!coin.collected) {
            const dx = (playerX + 40) - (coin.x + 20);
            const dy = (gameState.playerY - 60) - (coin.y + 20);
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            const range = magnetRef.current ? 300 : 60;

            if (distance < range) { 
                if (magnetRef.current && distance > 40) {
                    coin.x += (playerX - coin.x) * 0.15;
                    coin.y += ((gameState.playerY - 60) - coin.y) * 0.15;
                } else {
                    coin.collected = true;
                    setCoins(prev => prev + 1);
                }
            }
        }
      });

      draw(ctx, gameState, canvas.width, canvas.height);
      animationId = requestAnimationFrame(update);
    };

    const draw = (ctx: CanvasRenderingContext2D, state: any, w: number, h: number) => {
      const floorY = h - FLOOR_OFFSET;

      // Background
      ctx.fillStyle = '#0f0e17';
      ctx.fillRect(0, 0, w, h);

      if (bgImg.current.complete) {
          const bgW = 1920; 
          ctx.drawImage(bgImg.current, state.bgX, 0, bgW, h); 
          ctx.drawImage(bgImg.current, state.bgX + bgW, 0, bgW, h);
          ctx.drawImage(bgImg.current, state.bgX + 2*bgW, 0, bgW, h);
      }

      // Floor Line
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#00fff5';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, floorY);
      ctx.lineTo(w, floorY);
      ctx.stroke();

      // Player
      const drawY = state.playerY - PLAYER_HEIGHT;

      // SHIELD VISUAL -------------- (FIXED)
      if (shieldVisual) {
          ctx.save();
          ctx.shadowColor = '#00fff5';
          ctx.shadowBlur = 20;
          ctx.strokeStyle = '#00fff5';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(100 + (PLAYER_WIDTH/2), drawY + (PLAYER_HEIGHT/2), 50, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
      }

      // Animation
      const animationSpeed = 8; 
      const totalFrames = 6;
      const currentGlobalFrame = Math.floor(state.frameCount / animationSpeed) % totalFrames;

      if (nftRef.current) {
          let targetSheet = hoverboardSheet1.current;
          let frameIndex = currentGlobalFrame;
          
          if (currentGlobalFrame >= 3) { 
              targetSheet = hoverboardSheet2.current; 
              frameIndex = currentGlobalFrame - 3; 
          }

          if (targetSheet.complete && targetSheet.naturalWidth > 0) {
            const spriteW = targetSheet.naturalWidth / 3;
            const spriteH = targetSheet.naturalHeight;
            const sx = (frameIndex * spriteW) + 5;
            const sWidth = spriteW - 10;
            ctx.drawImage(targetSheet, sx, 0, sWidth, spriteH, 100, drawY, PLAYER_WIDTH, PLAYER_HEIGHT);
          }
      } else {
          if (state.isJumping) {
              if (playerJumpImg.current.complete) {
                  ctx.drawImage(playerJumpImg.current, 100, drawY, PLAYER_WIDTH, PLAYER_HEIGHT);
              } else {
                  ctx.fillStyle = '#00ff00';
                  ctx.fillRect(100, drawY, PLAYER_WIDTH, PLAYER_HEIGHT);
              }
          } else {
              let targetSheet = playerRunSheet1.current;
              let frameIndex = currentGlobalFrame; 
              if (currentGlobalFrame >= 3) { 
                  targetSheet = playerRunSheet2.current; 
                  frameIndex = currentGlobalFrame - 3; 
              }

              if (targetSheet.complete && targetSheet.naturalWidth > 0) {
                const spriteW = targetSheet.naturalWidth / 3;
                const spriteH = targetSheet.naturalHeight;
                const sx = (frameIndex * spriteW) + 2;
                const sWidth = spriteW - 4;
                ctx.drawImage(targetSheet, sx, 0, sWidth, spriteH, 100, drawY, PLAYER_WIDTH, PLAYER_HEIGHT);
              } else {
                ctx.fillStyle = '#ff00ff';
                ctx.fillRect(100, drawY, PLAYER_WIDTH, PLAYER_HEIGHT);
              }
          }
      }

      // Obstacles
      state.obstacles.forEach((obs: any) => {
          if (obs.type === 'wall') {
              if (obstacleImg.current.complete) {
                const animSpeed = 30; 
                const totalF = 3; 
                const currentF = Math.floor(state.frameCount / animSpeed) % totalF;
                const spriteW = obstacleImg.current.naturalWidth / totalF;
                const spriteH = obstacleImg.current.naturalHeight;
                const sx = currentF * spriteW;

                ctx.drawImage(
                    obstacleImg.current,
                    sx, 0, spriteW, spriteH,
                    obs.x,
                    obs.y, // CHANGED: draw at stored y (already includes offset)
                    OBSTACLE_WIDTH,
                    OBSTACLE_HEIGHT
                );
              } else {
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
              }
          } else {
              ctx.fillStyle = '#000';
              ctx.strokeStyle = '#00fff5';
              ctx.lineWidth = 3;
              ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
              ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
              ctx.beginPath();
              ctx.moveTo(obs.x + 10, obs.y + 10);
              ctx.lineTo(obs.x + obs.w - 10, obs.y + 10);
              ctx.stroke();
          }
      });

      // Coins
      state.gameCoins.forEach((coin: any) => {
        if (!coin.collected) {
           if (coinImg.current.complete) {
               const ratio = coinImg.current.naturalWidth / coinImg.current.naturalHeight;
               const baseHeight = 40;
               const baseWidth = baseHeight * ratio;
               const spin = Math.abs(Math.sin(state.frameCount * 0.1));
               const currentWidth = Math.max(5, baseWidth * spin);
               const xOffset = (baseWidth - currentWidth) / 2;

               ctx.drawImage(coinImg.current, coin.x + xOffset, coin.y, currentWidth, baseHeight);
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
            const jumpStrength = nftRef.current ? HOVER_JUMP_STRENGTH : NORMAL_JUMP_STRENGTH;
            gameState.velocity = jumpStrength;
            gameState.isJumping = true;
          }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    animationId = requestAnimationFrame(update);

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
  }, [gameActive, hasMagnet, hasShield, hasNFT]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', overflow: 'hidden', background: '#000', zIndex: 9999 }}>
      
      {/* HUD + FIXED SYNTAX LINES */}
      <div style={{ position: 'absolute', top: 20, left: 20, color: '#00fff5', fontFamily: 'monospace', fontSize: '1.5rem', zIndex: 10, textShadow: '0 0 5px #00fff5', background: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '8px' }}>
        <div>TIME: {timeLeft}s</div>
        <div>COINS: {coins}</div>

        {shieldVisual && (
          <div style={{ fontSize: "1rem", color: "#00fff5" }}>🛡️ SHIELD ON</div>
        )}

        {magnetRef.current && (
          <div style={{ fontSize: "1rem", color: "#f9bc60" }}>🧲 MAGNET ON</div>
        )}

        {nftRef.current && (
          <div style={{ fontSize: "1rem", color: "#ff00ff" }}>🛹 HOVERBOARD</div>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'block' }} />

      <div style={{ position: 'absolute', bottom: 20, width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', zIndex: 10 }}>
        PRESS SPACE TO JUMP
      </div>
    </div>
  );
};

export default CyberGame;
