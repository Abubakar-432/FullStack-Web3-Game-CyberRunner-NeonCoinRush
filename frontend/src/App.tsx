import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import axios from 'axios';
import CyberGame from './CyberGame';
import CyberStore from './CyberStore';
import ContractABIs from './ContractABIs.json';
import './App.css';

// ⚠️ REPLACE WITH YOUR REAL NEONCOIN ADDRESS ⚠️
const NEON_COIN_ADDRESS = "0xYOUR_NEON_COIN_ADDRESS_HERE";

function App() {
  const [wallet, setWallet] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  
  // New Game Stats
  const [fails, setFails] = useState(0);
  const [balance, setBalance] = useState("0");

  const connectWallet = async () => {
    // Cast window to 'any' to avoid TypeScript complaining about 'ethereum'
    const { ethereum } = window as any;

    if (ethereum) {
      try {
        const provider = new ethers.BrowserProvider(ethereum);
        
        // 🛑 FORCE THE POPUP: Explicitly ask to connect
        await provider.send("eth_requestAccounts", []);
        
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        setWallet(address);
      } catch (error) {
        console.error("Connection Error:", error);
        alert("Failed to connect. Open console (F12) for details.");
      }
    } else {
      alert("MetaMask is not installed!");
    }
  };

  // --- NEW: Fetch Player Stats from Blockchain ---
  const fetchStats = useCallback(async () => {
    if (!wallet) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(NEON_COIN_ADDRESS, ContractABIs.NeonCoin, provider);
      
      // 1. Get Fails Count
      const failsCount = await contract.consecutiveFails(wallet);
      setFails(Number(failsCount));

      // 2. Get Balance (Available Reward)
      const rawBal = await contract.balanceOf(wallet);
      setBalance(parseFloat(ethers.formatUnits(rawBal, 18)).toFixed(1));

    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, [wallet]);

  // Update stats whenever wallet connects or game ends
  useEffect(() => {
    fetchStats();
  }, [fetchStats, isPlaying]); // Re-run when game active state changes

  const handleGameEnd = async (result: "win" | "fail", coins: number) => {
    setIsPlaying(false);
    if (!wallet) return alert("Connect wallet first!");
    
    setStatus(`Processing ${result.toUpperCase()}...`);

    try {
      const response = await axios.post("http://127.0.0.1:8000/submit-run", {
        player_address: wallet,
        result: result,
        coins_collected: coins
      });

      if (response.data.status === "success") {
        setStatus(`Transaction Success! Hash: ${response.data.tx_hash.substring(0, 10)}...`);
        // Refresh stats immediately after transaction
        setTimeout(fetchStats, 2000); 
      } else {
        setStatus(`Error: ${response.data.message}`);
      }
    } catch (error) {
      console.error(error);
      setStatus("Failed to connect to backend.");
    }
  };

  // Calculate Risk Label
  const riskColor = fails >= 3 ? "#ff0000" : fails > 0 ? "#f9bc60" : "#00fff5";
  const attemptsLeft = 5 - fails;

  return (
    <div style={{ backgroundColor: "#0f0e17", color: "#fffffe", minHeight: "100vh", padding: "20px", textAlign: "center", fontFamily: "monospace" }}>
      <h1 style={{ color: "#ff8906", textShadow: "0 0 10px #ff8906", marginBottom: "30px" }}>CYBER RUNNER: NEON RUSH</h1>
      
      {!wallet ? (
        <button onClick={connectWallet} style={{ padding: "15px 30px", fontSize: "1.5rem", cursor: "pointer", background: "#f25f4c", border: "none", color: "white", borderRadius: "8px" }}>
          CONNECT WALLET
        </button>
      ) : (
        <div>
          <div style={{ marginBottom: "20px" }}>
             <span style={{ color: "#a7a9be" }}>Player: </span>
             <span style={{ color: "#00fff5" }}>{wallet.substring(0, 6)}...{wallet.substring(38)}</span>
          </div>

          {!isPlaying ? (
            <>
              <div style={{ border: "2px dashed #ff8906", padding: "40px", margin: "20px auto", maxWidth: "600px", background: "rgba(255, 137, 6, 0.05)" }}>
                <h2>READY RUNNER ONE?</h2>
                
                {/* --- NEW STATS DISPLAY --- */}
                <div style={{ display: "flex", justifyContent: "space-around", marginBottom: "20px", fontSize: "1.1rem" }}>
                    <div style={{ color: riskColor }}>
                        <div>⚠️ ATTEMPTS</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{fails} / 5 Used</div>
                        <div style={{ fontSize: "0.8rem" }}>({attemptsLeft} Safe Runs Left)</div>
                    </div>
                    <div style={{ color: "#2cb67d" }}>
                        <div>💰 WALLET</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{balance} NNC</div>
                        <div style={{ fontSize: "0.8rem" }}>Available Reward</div>
                    </div>
                </div>

                <p style={{ marginBottom: "30px", color: "#a7a9be" }}>Collect coins. Avoid walls. Survive 60 seconds.</p>
                
                <button onClick={() => setIsPlaying(true)} style={{ padding: "15px 40px", fontSize: "1.2rem", background: "#2cb67d", border: "none", cursor: "pointer", color: "white", fontWeight: "bold", borderRadius: "50px", boxShadow: "0 0 15px #2cb67d" }}>
                  START MISSION
                </button>
                
                <p style={{ marginTop: "20px", color: "#e53170" }}>{status}</p>
              </div>

              <CyberStore wallet={wallet} />
            </>
          ) : (
            <CyberGame onGameOver={handleGameEnd} />
          )}
        </div>
      )}
    </div>
  );
}

export default App;