import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import ContractABIs from './ContractABIs.json';
import './App.css';

// ⚠️ PASTE ADDRESSES HERE ⚠️
const NEON_COIN_ADDRESS = "0x12D53760bE78beB3f65321c077B5357E981eFf12";
const HOVERBOARD_ADDRESS = "0x2ae7dcA5fFA1a9cd85786FFFF800320Ff04b38e8";

interface CyberStoreProps {
  wallet: string;
  onPurchase: () => void;
  onHoverboardNameChange?: (name: string) => void;
}

const CyberStore = ({ wallet, onPurchase, onHoverboardNameChange }: CyberStoreProps) => {
  const [loading, setLoading] = useState("");
  const [balance, setBalance] = useState("0");

  const [hasShield, setHasShield] = useState(false);
  const [hasMagnet, setHasMagnet] = useState(false);
  const [hasNFT, setHasNFT] = useState(false);

  // Modal state for hoverboard name
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempName, setTempName] = useState("");

  const getContracts = async () => {
    if (!window.ethereum) throw new Error("No wallet");
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return {
      neonCoin: new ethers.Contract(NEON_COIN_ADDRESS, ContractABIs.NeonCoin, signer),
      hoverboard: new ethers.Contract(HOVERBOARD_ADDRESS, ContractABIs.HoverboardNFT, signer)
    };
  };

  const fetchBalanceAndInventory = useCallback(async () => {
    if (!wallet) return;
    try {
      const { neonCoin, hoverboard } = await getContracts();

      const rawBal = await neonCoin.balanceOf(wallet);
      setBalance(parseFloat(ethers.formatUnits(rawBal, 18)).toFixed(1));

      // Shield / Magnet inventory from NeonCoin
      const shield = await neonCoin.hasShield(wallet);
      const magnet = await neonCoin.hasMagnet(wallet);
      setHasShield(shield);
      setHasMagnet(magnet);

      // NFT balance from HoverboardNFT
      let nftOwned = false;
      try {
        const nftBal = await hoverboard.balanceOf(wallet);
        nftOwned = Number(nftBal) > 0;
      } catch (e) {
        console.warn("NFT check failed in store", e);
      }
      setHasNFT(nftOwned);
    } catch (e) {
      console.error("Store fetch error", e);
    }
  }, [wallet]);

  useEffect(() => {
    fetchBalanceAndInventory();
  }, [fetchBalanceAndInventory]);

  const buyItem = async (item: "shield" | "magnet", price: string) => {
    // "Already in inventory" logic
    if (item === "shield" && hasShield) {
      alert("Shield already in inventory.");
      return;
    }
    if (item === "magnet" && hasMagnet) {
      alert("Magnet already in inventory.");
      return;
    }

    if (parseFloat(balance) < parseFloat(price)) return alert("Insufficient Funds");
    setLoading(`Buying ${item}...`);
    try {
      const { neonCoin } = await getContracts();
      const tx = item === "shield" ? await neonCoin.buyShield() : await neonCoin.buyMagnet();
      await tx.wait();
      alert(`Purchased ${item.toUpperCase()}! Inventory Updated.`);
      
      // Update local inventory state
      if (item === "shield") setHasShield(true);
      if (item === "magnet") setHasMagnet(true);

      fetchBalanceAndInventory(); // refresh balance + inventory
      onPurchase();               // notify App to refresh global stats
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Transaction failed");
    }
    setLoading("");
  };

  const buyHoverboard = async () => {
    // "Already Owned" logic
    if (hasNFT) {
      alert("Hoverboard NFT already owned.");
      return;
    }

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
      const mintTx = await hoverboard.mintBoard({ gasLimit: 300000 });
      await mintTx.wait();
      
      alert("NFT Minted!");
      setHasNFT(true);
      fetchBalanceAndInventory();
      onPurchase();

      // Open name modal after successful mint
      setTempName("");
      setShowNameModal(true);
    } catch (e: any) {
      console.error(e);
      alert("Transaction Failed: " + (e.reason || e.message || "Unknown error")); 
    }
    setLoading("");
  };

  const handleSaveName = () => {
    const trimmed = tempName.trim();
    if (!trimmed) {
      alert("Please enter a valid name.");
      return;
    }
    if (onHoverboardNameChange) {
      onHoverboardNameChange(trimmed);
    }
    setShowNameModal(false);
  };

  const handleCancelName = () => {
    setShowNameModal(false);
    setTempName("");
  };

  const shieldLabel = hasShield ? "Already in inventory" : "BUY";
  const magnetLabel = hasMagnet ? "Already in inventory" : "BUY";
  const nftLabel = hasNFT ? "Already Owned" : "MINT";

  return (
    <>
      {/* MAIN STORE CARD */}
      <div className="cyber-card">
        <h2 className="neon-text-blue" style={{ marginTop: 0 }}>CYBER STORE</h2>
        {loading && <p className="neon-text-pink">⏳ {loading}</p>}
        <p style={{ color: "#a7a9be", fontSize: "0.9rem", marginTop: 0 }}>
          Balance: <span className="neon-text-blue">{balance} NNC</span>
        </p>
        
        <div style={{ display: "flex", gap: "15px", justifyContent: "center", flexWrap: "wrap" }}>
          {/* SHIELD */}
          <div className="store-item">
            <div style={{ fontSize: "2.5rem" }}>🛡️</div>
            <h3>SHIELD</h3>
            <div className="neon-text-blue">15 NNC</div>
            <button
              onClick={() => buyItem("shield", "15")}
              className="cyber-btn"
              style={{ fontSize: "1rem", padding: "5px 10px", width: "100%" }}
              disabled={hasShield || !!loading}
            >
              {shieldLabel}
            </button>
          </div>

          {/* MAGNET */}
          <div className="store-item">
            <div style={{ fontSize: "2.5rem" }}>🧲</div>
            <h3>MAGNET</h3>
            <div className="neon-text-blue">20 NNC</div>
            <button
              onClick={() => buyItem("magnet", "20")}
              className="cyber-btn"
              style={{ fontSize: "1rem", padding: "5px 10px", width: "100%" }}
              disabled={hasMagnet || !!loading}
            >
              {magnetLabel}
            </button>
          </div>

          {/* NFT */}
          <div className="store-item" style={{ borderColor: "#ff00ff" }}>
            <div style={{ fontSize: "2.5rem" }}>🛹</div>
            <h3 style={{ color: "#ff00ff" }}>NFT</h3>
            <div className="neon-text-pink">30 NNC</div>
            <button
              onClick={buyHoverboard}
              className="cyber-btn pink"
              style={{ fontSize: "1rem", padding: "5px 10px", width: "100%" }}
              disabled={hasNFT || !!loading}
            >
              {nftLabel}
            </button>
          </div>
        </div>
      </div>

      {/* INLINE STYLES FOR STORE CARD HOVER */}
      {/* (Your original dynamic style injection kept) */}
      {/* Name Modal */}
      {showNameModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999
          }}
        >
          <div
            style={{
              background: "rgba(5, 8, 22, 0.95)",
              border: "1px solid #ff00ff",
              boxShadow: "0 0 20px rgba(255, 0, 255, 0.4)",
              borderRadius: "12px",
              padding: "20px 24px",
              maxWidth: "400px",
              width: "90%",
              fontFamily: "monospace",
              color: "#f9fafb"
            }}
          >
            <div
              style={{
                fontSize: "0.9rem",
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "#ff00ff",
                marginBottom: "8px"
              }}
            >
              🛹 Hoverboard Minted
            </div>
            <h3 style={{ margin: "0 0 10px 0" }}>Name your hoverboard</h3>
            <p style={{ margin: "0 0 12px 0", fontSize: "0.85rem", color: "#9ca3af" }}>
              This name will appear in your loadout and in-game HUD.
            </p>
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              placeholder="e.g. Anaya's Board"
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid #4b5563",
                background: "#020617",
                color: "#e5e7eb",
                marginBottom: "14px",
                fontFamily: "monospace",
                fontSize: "0.9rem"
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={handleCancelName}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: "1px solid #4b5563",
                  background: "transparent",
                  color: "#9ca3af",
                  fontSize: "0.85rem",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveName}
                style={{
                  padding: "6px 14px",
                  borderRadius: "6px",
                  border: "1px solid #ff00ff",
                  background: "#ff00ff",
                  color: "#020617",
                  fontSize: "0.85rem",
                  fontWeight: "bold",
                  cursor: "pointer",
                  boxShadow: "0 0 10px rgba(255,0,255,0.5)"
                }}
              >
                Save Name
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// keep your original hover style injection
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
