import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import ContractABIs from './ContractABIs.json';

// ⚠️ KEEP YOUR REAL ADDRESSES HERE ⚠️
const NEON_COIN_ADDRESS = "0x491374Ca73d66028467A4592C0013031b19a0875";
const HOVERBOARD_ADDRESS = "0xYOUR_HOVERBOARD_ADDRESS_HERE";

const CyberStore = ({ wallet }: { wallet: string }) => {
  const [loading, setLoading] = useState("");
  const [balance, setBalance] = useState("0");

  // Helper to connect
  const getContracts = async () => {
    if (!window.ethereum) throw new Error("No crypto wallet found");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const neonCoin = new ethers.Contract(NEON_COIN_ADDRESS, ContractABIs.NeonCoin, signer);
    const hoverboard = new ethers.Contract(HOVERBOARD_ADDRESS, ContractABIs.HoverboardNFT, signer);
    return { neonCoin, hoverboard };
  };

  const fetchBalance = useCallback(async () => {
    try {
        const { neonCoin } = await getContracts();
        const rawBalance = await neonCoin.balanceOf(wallet);
        const formatted = ethers.formatUnits(rawBalance, 18);
        setBalance(parseFloat(formatted).toFixed(1));
    } catch (e) {
        console.error("Error fetching balance:", e);
    }
  }, [wallet]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const buyItem = async (item: "shield" | "magnet", price: string) => {
    if (!wallet) return alert("Connect wallet first");
    
    if (parseFloat(balance) < parseFloat(price)) {
        alert(`Not enough NNC! You have ${balance}, need ${price}.`);
        return;
    }

    setLoading(`Buying ${item.toUpperCase()}...`);
    try {
      const { neonCoin } = await getContracts();
      const tx = item === "shield" ? await neonCoin.buyShield() : await neonCoin.buyMagnet();
      await tx.wait(); 
      alert(`${item.toUpperCase()} Purchased!`);
      fetchBalance(); 
    } catch (error: any) {
      const msg = error.reason || error.message || "Transaction failed";
      alert("Error: " + msg);
    }
    setLoading("");
  };

  const buyHoverboard = async () => {
    if (!wallet) return alert("Connect wallet first");
    if (parseFloat(balance) < 30) return alert(`Not enough NNC! Need 30.`);

    setLoading("Step 1/2: Approving...");
    try {
      const { neonCoin, hoverboard } = await getContracts();
      const priceInWei = ethers.parseUnits("30", 18);
      
      const approveTx = await neonCoin.approve(HOVERBOARD_ADDRESS, priceInWei);
      await approveTx.wait();

      setLoading("Step 2/2: Minting...");
      const mintTx = await hoverboard.mintBoard();
      await mintTx.wait();
      
      alert("🎉 HOVERBOARD ACQUIRED!");
      fetchBalance(); 
    } catch (error: any) {
       const msg = error.reason || error.message || "Transaction failed";
       alert("Error: " + msg.substring(0, 100));
    }
    setLoading("");
  };

  // --- FIXED STYLES ---
  const containerStyle: React.CSSProperties = { 
      border: "2px solid #00fff5", 
      padding: "20px", 
      margin: "20px auto", 
      maxWidth: "600px", 
      borderRadius: "10px", 
      background: "rgba(0, 255, 245, 0.05)", 
      position: "relative" 
  };
  
  const headerStyle: React.CSSProperties = { 
      color: "#00fff5", 
      textShadow: "0 0 5px #00fff5", 
      marginTop: 0 
  };
  
  const balanceBoxStyle: React.CSSProperties = { 
      position: "absolute", 
      top: "20px", 
      right: "20px", 
      border: "1px solid #f9bc60", 
      color: "#f9bc60", 
      padding: "5px 10px", 
      borderRadius: "5px", 
      fontWeight: "bold", 
      background: "#000" 
  };

  const gridStyle: React.CSSProperties = { 
      display: "flex", 
      justifyContent: "center", 
      gap: "15px", 
      flexWrap: "wrap", 
      marginTop: "15px" 
  };
  
  const cardStyle: React.CSSProperties = { 
      border: "1px solid #a7a9be", 
      padding: "15px", 
      borderRadius: "8px", 
      width: "160px", 
      background: "#0f0e17" 
  };
  
  const priceStyle: React.CSSProperties = { 
      color: "#f9bc60", 
      fontWeight: "bold" 
  };
  
  const btnStyle: React.CSSProperties = { 
      background: "#00fff5", 
      border: "none", 
      padding: "10px 20px", 
      cursor: "pointer", 
      fontWeight: "bold", 
      color: "#0f0e17", 
      borderRadius: "5px", 
      marginTop: "10px", 
      width: "100%" 
  };

  return (
    <div style={containerStyle}>
      <h2 style={headerStyle}>CYBER STORE</h2>
      
      <div style={balanceBoxStyle}>
        💰 {balance} NNC
      </div>

      {loading && <p style={{ color: "#ff8906", fontWeight: "bold" }}>⏳ {loading}</p>}
      
      <div style={gridStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: "2rem" }}>🛡️</div>
          <h3>SHIELD</h3>
          <p style={{ fontSize: "0.9rem", color: "#a7a9be" }}>Survive 1 Crash</p>
          <p style={priceStyle}>15 NNC</p>
          <button onClick={() => buyItem("shield", "15")} style={btnStyle}>BUY</button>
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: "2rem" }}>🧲</div>
          <h3>MAGNET</h3>
          <p style={{ fontSize: "0.9rem", color: "#a7a9be" }}>+5 Coins Next Run</p>
          <p style={priceStyle}>20 NNC</p>
          <button onClick={() => buyItem("magnet", "20")} style={btnStyle}>BUY</button>
        </div>

        <div style={{ ...cardStyle, borderColor: "#ff00ff" }}>
          <div style={{ fontSize: "2rem" }}>🛹</div>
          <h3 style={{ color: "#ff00ff" }}>HOVERBOARD</h3>
          <p style={{ fontSize: "0.9rem", color: "#a7a9be" }}>Permanent 2x Boost</p>
          <p style={{ ...priceStyle, color: "#ff00ff" }}>30 NNC</p>
          <button onClick={buyHoverboard} style={{ ...btnStyle, background: "#ff00ff", color: "white" }}>MINT NFT</button>
        </div>
      </div>
    </div>
  );
};

export default CyberStore;