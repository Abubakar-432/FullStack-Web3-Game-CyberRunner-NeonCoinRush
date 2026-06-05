import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import CyberGame from './CyberGame';
import CyberStore from './CyberStore';
import ContractABIs from './ContractABIs.json';
import './App.css';

// ⚠️ REPLACE WITH YOUR REAL ADDRESSES ⚠️
const NEON_COIN_ADDRESS = "0x12D53760bE78beB3f65321c077B5357E981eFf12";
const HOVERBOARD_ADDRESS = "0x2ae7dcA5fFA1a9cd85786FFFF800320Ff04b38e8";

type TrackId = "track1" | "track2";

function App() {
  const [wallet, setWallet] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Custom Modal State
  const [modal, setModal] = useState<{
    show: boolean;
    type: "win" | "fail";
    coins: number;
    txHash?: string;
  } | null>(null);

  const [fails, setFails] = useState(0);
  const [balance, setBalance] = useState("0");
  
  // --- INVENTORY STATE ---
  const [inventory, setInventory] = useState({ hasShield: false, hasMagnet: false, hasNFT: false });

  // --- HOVERBOARD NAME PER WALLET ---
  const [hoverboardName, setHoverboardName] = useState<string | null>(null);

  // --- MUSIC STATE ---
  const [gameTrack, setGameTrack] = useState<TrackId>("track1");
  const [isPreviewing, setIsPreviewing] = useState(false);

  const mainAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<TrackId | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Detect wallet account change or disconnect from MetaMask
  useEffect(() => {
    const { ethereum } = window as any;
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
         // Only update if we are already logged in (prevent auto-connect on load)
         // We rely on 'wallet' state being non-empty to know we are "connected"
         setWallet((prev) => (prev ? accounts[0] : ""));
      }
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    return () => ethereum.removeListener("accountsChanged", handleAccountsChanged);
  }, []);

  
  // Load saved hoverboard name whenever wallet changes
  useEffect(() => {
    if (!wallet) {
      setHoverboardName(null);
      return;
    }
    try {
      const key = `hoverboardName:${wallet.toLowerCase()}`;
      const stored = window.localStorage.getItem(key);
      setHoverboardName(stored || null);
    } catch (e) {
      console.warn("Could not load hoverboard name", e);
      setHoverboardName(null);
    }
  }, [wallet]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (mainAudioRef.current) {
        mainAudioRef.current.pause();
        mainAudioRef.current = null;
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const connectWallet = async () => {
    const { ethereum } = window as any;
    if (ethereum) {
      try {
        const provider = new ethers.BrowserProvider(ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = await provider.getSigner();
        setWallet(await signer.getAddress());
      } catch (error) {
        alert("Connection failed!");
      }
    } else {
      alert("MetaMask not found!");
    }
  };

  const disconnectWallet = () => {
    stopMainAudio();
    setWallet("");
    setIsPlaying(false);
    setInventory({ hasShield: false, hasMagnet: false, hasNFT: false });
    setFails(0);
    setBalance("0");
    setStatus("");
    setHoverboardName(null);
    setModal(null);
  };


  const fetchStats = useCallback(async () => {
    if (!wallet) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const neonContract = new ethers.Contract(NEON_COIN_ADDRESS, ContractABIs.NeonCoin, provider);
      const nftContract = new ethers.Contract(HOVERBOARD_ADDRESS, ContractABIs.HoverboardNFT, provider);
      
      // 1. Stats
      const failsCount = await neonContract.consecutiveFails(wallet);
      setFails(Number(failsCount));
      const rawBal = await neonContract.balanceOf(wallet);
      setBalance(parseFloat(ethers.formatUnits(rawBal, 18)).toFixed(1));

      // 2. Inventory Check
      const shield = await neonContract.hasShield(wallet);
      const magnet = await neonContract.hasMagnet(wallet);
      
      // Check NFT Balance
      let hasNFT = false;
      try {
          const nftBal = await nftContract.balanceOf(wallet);
          hasNFT = Number(nftBal) > 0;
      } catch (e) {
          console.warn("NFT Check failed", e);
      }

      setInventory({ hasShield: shield, hasMagnet: magnet, hasNFT: hasNFT });

    } catch (error) {
      console.error("Fetch Stats Error:", error);
    }
  }, [wallet]);

  // Poll every 5 seconds
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Callback for store purchases
  const handlePurchase = () => {
      setStatus("Updating Inventory...");
      setTimeout(() => {
          fetchStats();
          setStatus("");
      }, 3000);
  };

  // Save hoverboard name globally + to localStorage
  const handleHoverboardNameChange = (name: string) => {
    setHoverboardName(name);
    if (wallet) {
      try {
        const key = `hoverboardName:${wallet.toLowerCase()}`;
        window.localStorage.setItem(key, name);
      } catch (e) {
        console.warn("Could not save hoverboard name", e);
      }
    }
  };

  // --- MUSIC HELPERS ---

  const getTrackSrc = (track: TrackId) =>
    track === "track1" ? "/track1.mp3" : "/track2.mp3";

  const playMainTrack = (track: TrackId, startTime: number = 0) => {
    const src = getTrackSrc(track);
    let audio = mainAudioRef.current;

    if (!audio) {
      audio = new Audio(src);
      mainAudioRef.current = audio;
    } else {
      const existingFile = audio.src.split("/").pop();
      const desiredFile = src.replace("/", "");
      if (existingFile !== desiredFile) {
        audio.pause();
        audio.src = src;
      }
    }

    audio.loop = true;

    const startPlayback = () => {
      try {
        if (startTime >= 0) {
          audio!.currentTime = startTime;
        }
      } catch {
        // Sometimes currentTime fails before metadata is loaded; ignore
      }

      audio!
        .play()
        .then(() => {
          currentTrackRef.current = track;
        })
        .catch(err => console.warn("Audio play failed", err));
    };

    if (audio.readyState >= 1) {
      startPlayback();
    } else {
      audio.addEventListener("loadedmetadata", startPlayback, { once: true });
    }
  };

  const stopMainAudio = () => {
    if (mainAudioRef.current) {
      mainAudioRef.current.pause();
      mainAudioRef.current.currentTime = 0;
    }
    currentTrackRef.current = null;
  };

  const handleGameTrackChange = (track: TrackId) => {
    setGameTrack(track);
  };

  const handlePreviewGameTrack = () => {
    const src = getTrackSrc(gameTrack);

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }

    const audio = new Audio(src);
    previewAudioRef.current = audio;
    setIsPreviewing(true);

    audio.play()
      .then(() => {
        setTimeout(() => {
          if (previewAudioRef.current === audio) {
            audio.pause();
            previewAudioRef.current = null;
            setIsPreviewing(false);
          }
        }, 30000);
      })
      .catch(e => {
        console.warn("Preview play failed", e);
        setIsPreviewing(false);
      });
  };

  const handleStartGame = () => {
    if (!wallet) {
     alert("Please connect wallet first.");
     return;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setIsPreviewing(false);
    }

    // Start Game Music
    playMainTrack(gameTrack, 0);
    setIsPlaying(true);
  };

  const handleGameEnd = async (result: "win" | "fail", coins: number) => {
    stopMainAudio(); // Stop music immediately
    setIsPlaying(false);
    
    // Initial Modal State
    setModal({ show: true, type: result, coins });

    if (!wallet) return; // Should be connected
    
    setInventory(prev => ({ 
        ...prev, 
        hasShield: false, 
        hasMagnet: false 
    }));

    setStatus(`Processing ${result.toUpperCase()}...`);
    try {
      const response = await axios.post("http://127.0.0.1:8000/submit-run", {
        player_address: wallet,
        result: result,
        coins_collected: coins
      });
      if (response.data.status === "success") {
        const tx = response.data.tx_hash || "";
        // Update modal with tx hash
        setModal(prev => prev ? { ...prev, txHash: tx } : null);
        setStatus(""); // Clear status as modal shows info
        setTimeout(fetchStats, 2000); 
      } else {
          setStatus("Error: " + JSON.stringify(response.data));
      }
    } catch (error: any) {
      console.error("Backend Error:", error);
      const blob = error?.response?.data ?? error?.message ?? String(error);
      setStatus("Backend Error: " + JSON.stringify(blob));
    }
  };

  const riskColor = fails >= 3 ? "#ff2e63" : "#00fff5";

  const hoverboardLabel = hoverboardName
    ? `${hoverboardName}'s Hoverboard`
    : "HOVERBOARD";

  return (
    <div className="cyber-container">
      {/* LOGO */}
      <div style={{ marginBottom: "40px", display: "flex", justifyContent: "center" }}>
        <img 
          src="/logo.png" 
          alt="Cyber Runner Logo" 
          style={{ 
            maxWidth: "100%", 
            height: "auto", 
            maxHeight: "550px",
            display: "block"
          }} 
        />
      </div>
      
      {!wallet ? (
        <div className="cyber-card">
          <p>Connect your Neural Link to begin.</p>
          <button onClick={connectWallet} className="cyber-btn pink">
            CONNECT WALLET
          </button>
        </div>
      ) : (
        <>
          <div style={{ 
              marginBottom: "10px", 
              fontSize: "0.9rem", 
              color: "gray",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center" 
            }}>
             <span>OPERATOR: <span style={{ color: "#fff" }}>{wallet.substring(0,6)}...{wallet.substring(38)}</span></span>
             <button 
               onClick={disconnectWallet}
               style={{
                 background: "transparent",
                 border: "1px solid #ff2e63",
                 color: "#ff2e63",
                 padding: "5px 10px",
                 borderRadius: "4px",
                 cursor: "pointer",
                 fontSize: "0.8rem",
                 textTransform: "uppercase"
               }}
             >
               Disconnect
             </button>
          </div>

          {/* MUSIC PANEL - REDUCED */}
          <div className="cyber-card" style={{ marginBottom: "20px" }}>
            <h3
              style={{
                marginTop: 0,
                marginBottom: "10px",
                color: "#00fff5",
                letterSpacing: "2px",
                fontSize: "0.9rem",
                textTransform: "uppercase",
              }}
            >
              🎵 Soundtrack Control
            </h3>

            {/* In-Game Music Only */}
            <div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#a7a9be",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                In-Game Music
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "10px",
                  alignItems: "center",
                }}
              >
                <select
                  value={gameTrack}
                  onChange={(e) => handleGameTrackChange(e.target.value as TrackId)}
                  style={{
                    background: "#050816",
                    color: "#ff00ff",
                    border: "1px solid #ff00ff",
                    borderRadius: "4px",
                    padding: "6px 10px",
                    minWidth: "220px",
                    fontFamily: "monospace",
                  }}
                >
                  <option value="track1">Track 1 — Night City Drift</option>
                  <option value="track2">Track 2 — Neon Rush</option>
                </select>

                <button
                  onClick={handlePreviewGameTrack}
                  className="cyber-btn"
                  style={{ padding: "6px 16px", fontSize: "0.85rem" }}
                >
                  ▶ Preview In-Game Track (30s)
                </button>
              </div>

              {isPreviewing && (
                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "0.75rem",
                    color: "#a7a9be",
                    fontStyle: "italic",
                  }}
                >
                  Preview playing…
                </div>
              )}
            </div>
          </div>

          {!isPlaying ? (
            <>
              {/* START GAME CARD */}
              <div className="cyber-card">
                <div className="cyber-hud">
                    <div style={{ color: riskColor }}>
                        <div>⚠️ ATTEMPTS</div>
                        <strong>{fails} / 5</strong>
                    </div>
                    <div className="neon-text-blue">
                        <div>
                            💰 BALANCE 
                            <span onClick={fetchStats} style={{ cursor: "pointer", marginLeft: "10px", fontSize: "0.8rem" }}>🔄</span>
                        </div>
                        <strong>{balance} NNC</strong>
                    </div>
                </div>

                {inventory.hasNFT && (
                    <div style={{ margin: "10px 0", color: "#ff00ff", fontWeight: "bold", textShadow: "0 0 5px #ff00ff" }}>
                        🛹 {hoverboardLabel} (2x Coins)
                    </div>
                )}

                <h2 style={{ margin: "10px 0" }}>READY TO RUN?</h2>
                <p style={{ color: "#a7a9be" }}>Collect coins. Avoid walls. Survive.</p>
                
                <button onClick={handleStartGame} className="cyber-btn glitch">
                  START MISSION
                </button>
                
                {/* LOADOUT */}
                <div style={{ 
                    marginTop: "25px", 
                    background: "rgba(20, 20, 20, 0.8)", 
                    padding: "15px", 
                    borderRadius: "10px", 
                    border: "1px solid #333",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center"
                }}>
                    <div style={{ fontSize: "0.8rem", color: "#a7a9be", marginBottom: "10px", letterSpacing: "2px", textTransform: "uppercase" }}>
                        Active Modules for Next Run
                    </div>
                    
                    <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", justifyContent: "center" }}>
                        {!inventory.hasShield && !inventory.hasMagnet && !inventory.hasNFT && (
                            <span style={{ color: "#555", fontStyle: "italic" }}>No items equipped</span>
                        )}
                        
                        {inventory.hasShield && (
                            <span style={itemBadgeStyle("#00fff5")}>🛡️ SHIELD</span>
                        )}
                        {inventory.hasMagnet && (
                            <span style={itemBadgeStyle("#f9bc60")}>🧲 MAGNET</span>
                        )}
                        {inventory.hasNFT && (
                            <span style={itemBadgeStyle("#ff00ff")}>🛹 {hoverboardLabel}</span>
                        )}
                    </div>
                </div>
                
                <p style={{ marginTop: "20px", color: "#ff00ff", fontSize: "0.9rem" }}>{status}</p>
              </div>

              {/* STORE */}
              <CyberStore
                wallet={wallet}
                onPurchase={handlePurchase}
                onHoverboardNameChange={handleHoverboardNameChange}
              />
            </>
          ) : (
            <CyberGame 
                onGameOver={handleGameEnd} 
                hasMagnet={inventory.hasMagnet} 
                hasShield={inventory.hasShield}
                hasNFT={inventory.hasNFT}
                hoverboardName={hoverboardName || undefined}
                musicTrack={gameTrack}
            />
          )}
        </>
      )}

      {/* GAME OVER MODAL */}
      {modal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "rgba(0,0,0,0.85)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999
        }}>
          <div className="cyber-card" style={{ 
             maxWidth: "500px", 
             width: "90%", 
             textAlign: "center",
             border: modal.type === "win" ? "2px solid #00fff5" : "2px solid #ff2e63",
             boxShadow: modal.type === "win" ? "0 0 20px #00fff5" : "0 0 20px #ff2e63"
          }}>
             <h1 style={{ 
               color: modal.type === "win" ? "#00fff5" : "#ff2e63",
               textShadow: "0 0 10px currentColor",
               marginTop: 0
             }}>
               {modal.type === "win" ? "MISSION SUCCESS" : "MISSION FAILED"}
             </h1>
             
             <div style={{ fontSize: "1.2rem", margin: "20px 0" }}>
               COINS SECURED: <strong style={{ color: "#f9bc60" }}>{modal.coins}</strong>
             </div>
             
             {modal.type === "win" && (
                <div style={{ margin: "20px 0", fontSize: "0.9rem", color: "#a7a9be" }}>
                  <div>TRANSACTION HASH:</div>
                  {modal.txHash ? (
                    <a 
                      href={`https://sepolia.etherscan.io/tx/${modal.txHash}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: "#00fff5", textDecoration: "underline" }}
                    >
                      {modal.txHash.substring(0, 10)}...{modal.txHash.substring(60)}
                    </a>
                  ) : (
                    <span>Processing on Blockchain...</span>
                  )}
                </div>
             )}
             
             <button 
               onClick={() => setModal(null)} 
               className="cyber-btn"
               style={{ marginTop: "20px", width: "100%" }}
             >
               RETURN TO BASE
             </button>
          </div>
        </div>
      )}
    </div>
  );
}

const itemBadgeStyle = (color: string) => ({
    display: "flex", 
    alignItems: "center", 
    gap: "5px", 
    color: color, 
    border: `1px solid ${color}`, 
    padding: "5px 12px", 
    borderRadius: "20px",
    fontSize: "0.9rem",
    fontWeight: "bold",
    background: "rgba(0,0,0,0.3)",
    boxShadow: `0 0 5px ${color}40` 
});

export default App;
