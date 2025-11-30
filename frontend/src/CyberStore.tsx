import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import ContractABIs from './ContractABIs.json';
import './App.css'; 

// ⚠️ PASTE ADDRESSES HERE ⚠️
const NEON_COIN_ADDRESS = "0x12D53760bE78beB3f65321c077B5357E981eFf12";
const HOVERBOARD_ADDRESS = "0x2ae7dcA5fFA1a9cd85786FFFF800320Ff04b38e8"; 

// New Prop: onPurchase
const CyberStore = ({ wallet, onPurchase }: { wallet: string, onPurchase: () => void }) => {
  const [loading, setLoading] = useState("");
  const [balance, setBalance] = useState("0");

  const getContracts = async () => {
    if (!window.ethereum) throw new Error("No wallet");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return {
        neonCoin: new ethers.Contract(NEON_COIN_ADDRESS, ContractABIs.NeonCoin, signer),
        hoverboard: new ethers.Contract(HOVERBOARD_ADDRESS, ContractABIs.HoverboardNFT, signer)
    };
  };

  const fetchBalance = useCallback(async () => {
    try {
        const { neonCoin } = await getContracts();
        const raw = await neonCoin.balanceOf(wallet);
        setBalance(parseFloat(ethers.formatUnits(raw, 18)).toFixed(1));
    } catch (e) { console.error(e); }
  }, [wallet]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  const buyItem = async (item: "shield" | "magnet", price: string) => {
    if (parseFloat(balance) < parseFloat(price)) return alert("Insufficient Funds");
    setLoading(`Buying ${item}...`);
    try {
      const { neonCoin } = await getContracts();
      const tx = item === "shield" ? await neonCoin.buyShield() : await neonCoin.buyMagnet();
      await tx.wait();
      alert("Purchased! Inventory Updated.");
      fetchBalance(); // Update local balance
      onPurchase();   // Update APP inventory (The Fix!)
    } catch (e: any) { alert(e.message); }
    setLoading("");
  };

  const buyHoverboard = async () => {
    if (parseFloat(balance) < 30) return alert("Need 30 NNC");
    setLoading("Approving...");
    try {
      const { neonCoin, hoverboard } = await getContracts();
      const price = ethers.parseUnits("30", 18);
      
      // 1. Approve
      const appTx = await neonCoin.approve(HOVERBOARD_ADDRESS, price);
      await appTx.wait();
      
      setLoading("Minting...");
      
      // 2. Mint (WITH MANUAL GAS LIMIT - CRITICAL FIX)
      // We force 300,000 gas to ensure it has enough to talk between contracts
      const mintTx = await hoverboard.mintBoard({ gasLimit: 300000 });
      await mintTx.wait();
      
      alert("NFT Minted!");
      fetchBalance();
      onPurchase(); 
    } catch (e: any) { 
        console.error(e);
        // Show the actual error message
        alert("Transaction Failed: " + (e.reason || e.message || "Unknown error")); 
    }
    setLoading("");
  };

  return (
    <div className="cyber-card">
      <h2 className="neon-text-blue" style={{ marginTop: 0 }}>CYBER STORE</h2>
      {loading && <p className="neon-text-pink">⏳ {loading}</p>}
      
      <div style={{ display: "flex", gap: "15px", justifyContent: "center", flexWrap: "wrap" }}>
        <div className="store-item">
          <div style={{ fontSize: "2.5rem" }}>🛡️</div>
          <h3>SHIELD</h3>
          <div className="neon-text-blue">15 NNC</div>
          <button onClick={() => buyItem("shield", "15")} className="cyber-btn" style={{ fontSize: "1rem", padding: "5px 10px", width: "100%" }}>BUY</button>
        </div>
        <div className="store-item">
          <div style={{ fontSize: "2.5rem" }}>🧲</div>
          <h3>MAGNET</h3>
          <div className="neon-text-blue">20 NNC</div>
          <button onClick={() => buyItem("magnet", "20")} className="cyber-btn" style={{ fontSize: "1rem", padding: "5px 10px", width: "100%" }}>BUY</button>
        </div>
        <div className="store-item" style={{ borderColor: "#ff00ff" }}>
          <div style={{ fontSize: "2.5rem" }}>🛹</div>
          <h3 style={{ color: "#ff00ff" }}>NFT</h3>
          <div className="neon-text-pink">30 NNC</div>
          <button onClick={buyHoverboard} className="cyber-btn pink" style={{ fontSize: "1rem", padding: "5px 10px", width: "100%" }}>MINT</button>
        </div>
      </div>
    </div>
  );
};

const styles = `
  .store-item {
    background: rgba(0,0,0,0.6);
    border: 1px solid #333;
    border-radius: 8px;
    padding: 15px;
    width: 140px;
    transition: transform 0.2s;
  }
  .store-item:hover {
    transform: translateY(-5px);
    border-color: #00fff5;
    box-shadow: 0 0 10px rgba(0, 255, 245, 0.2);
  }
`;
const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

export default CyberStore;