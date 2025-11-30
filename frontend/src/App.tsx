import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import CyberGame from './CyberGame';
import CyberStore from './CyberStore';
import ContractABIs from './ContractABIs.json';
import './App.css';

// ⚠️ REPLACE WITH YOUR REAL ADDRESSES ⚠️
const NEON_COIN_ADDRESS = "0x12D53760bE78beB3f65321c077B5357E981eFf12";
const HOVERBOARD_ADDRESS = "0x2ae7dcA5fFA1a9cd85786FFFF800320Ff04b38e8"; 

function App() {
  const [wallet, setWallet] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [fails, setFails] = useState(0);
  const [balance, setBalance] = useState("0");
  
  // --- INVENTORY STATE ---
  const [inventory, setInventory] = useState({ hasShield: false, hasMagnet: false, hasNFT: false });

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

  const handleGameEnd = async (result: "win" | "fail", coins: number) => {
    setIsPlaying(false);
    if (!wallet) return alert("Connect wallet first!");
    
    // --- FIX: IMMEDIATE LOCAL RESET ---
    // Consumables are gone after a run, regardless of result.
    // NFT persists.
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
        setStatus(`Tx Hash: ${response.data.tx_hash.substring(0, 10)}...`);
        // Re-fetch stats after delay to sync with blockchain reality
        setTimeout(fetchStats, 10000); 
      } else {
          setStatus("Error: " + response.data.message);
      }
    } catch (error) {
      setStatus("Backend Error");
    }
  };

  const riskColor = fails >= 3 ? "#ff2e63" : "#00fff5";

  return (
    <div className="cyber-container">
      {/* 1. LOGO SECTION */}
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
          <div style={{ marginBottom: "10px", fontSize: "0.9rem", color: "gray" }}>
             OPERATOR: <span style={{ color: "#fff" }}>{wallet.substring(0,6)}...{wallet.substring(38)}</span>
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

                {/* Active Hoverboard Indicator */}
                {inventory.hasNFT && (
                    <div style={{ margin: "10px 0", color: "#ff00ff", fontWeight: "bold", textShadow: "0 0 5px #ff00ff" }}>
                        🛹 HOVERBOARD EQUIPPED (2x Coins)
                    </div>
                )}

                <h2 style={{ margin: "10px 0" }}>READY TO RUN?</h2>
                <p style={{ color: "#a7a9be" }}>Collect coins. Avoid walls. Survive.</p>
                
                <button onClick={() => setIsPlaying(true)} className="cyber-btn glitch">
                  START MISSION
                </button>
                
                {/* --- ACTIVE MODULES (LOADOUT) --- */}
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
                            <span style={itemBadgeStyle("#ff00ff")}>🛹 HOVERBOARD</span>
                        )}
                    </div>
                </div>
                
                <p style={{ marginTop: "20px", color: "#ff00ff", fontSize: "0.9rem" }}>{status}</p>
              </div>

              {/* STORE COMPONENT */}
              <CyberStore wallet={wallet} onPurchase={handlePurchase} />
            </>
          ) : (
            // PASS INVENTORY PROPS TO GAME
            <CyberGame 
                onGameOver={handleGameEnd} 
                hasMagnet={inventory.hasMagnet} 
                hasShield={inventory.hasShield}
                hasNFT={inventory.hasNFT} 
            />
          )}
        </>
      )}
    </div>
  );
}

// Helper style for the badges
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