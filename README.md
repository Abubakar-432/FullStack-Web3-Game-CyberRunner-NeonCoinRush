🕹️ CYBER RUNNER: NEON COIN RUSH
FULL STACK WEB3 GAME GUIDE

This document serves as the complete operational guide for the Cyber Runner project. It outlines the architecture, setup, deployment, and execution steps required to run the full Web3 game system.

⭐ 1. PROJECT ARCHITECTURE OVERVIEW

Cyber Runner operates as a full-stack, three-tier system:

🎮 Frontend (React + TypeScript)

The main game client and user interface.

🐍 Backend (Python + FastAPI)

Acts as an off-chain referee that validates game results to prevent cheating.

⛓️ Blockchain (Solidity on Sepolia Testnet)

Stores Neon Coins, Hoverboard NFTs, and player game data.

🔧 2. SETUP CHECKLIST

Before proceeding, ensure the following are correctly installed and configured:

Node.js and npm installed (required for React / Vite).

Python 3.12 installed (required for FastAPI backend).

MetaMask installed and connected to the Sepolia Testnet.

Game PNG assets placed inside:
frontend/public
(player1.png, player2.png, jump.png, coin.png, bg.png, obstacle.png)

A valid .env file created in both backend and frontend with the following:
• private wallet key
• contract addresses
• RPC URL

🚀 3. PHASE 1: SMART CONTRACT DEPLOYMENT

The contracts must be deployed in this exact order so the NFT contract knows the Neon Coin address (Address A).

Step A — Deploy NeonCoin.sol

Open Remix IDE.

Paste the final NeonCoin.sol code.

Compile the contract.

Switch the environment to “Injected Provider” (MetaMask).

Deploy.

Save the deployed address.
This is Address A (Neon Coin contract).

Step B — Deploy HoverboardNFT.sol

Paste the final HoverboardNFT.sol code into Remix.

In the constructor field, enter Address A.

Deploy the contract.

Save the deployed address.
This is Address B (Hoverboard NFT).

Step C — Link Contracts (Handshake)

In Remix, open the deployed NeonCoin contract (Address A).

Find the function: setHoverboardAddress.

Paste Address B.

Click Transact to finalize the link.

🔑 CONTRACT CONFIGURATION (VERY IMPORTANT)

Update the following values in your project:

backend/.env

CONTRACT_ADDRESS = Address A

HOVERBOARD_ADDRESS = Address B

frontend/src/App.tsx

NEON_COIN_ADDRESS = Address A

frontend/src/CyberStore.tsx

NEON_COIN_ADDRESS = Address A

HOVERBOARD_ADDRESS = Address B

🖥️ 4. PHASE 2: RUNNING THE APPLICATION

You must run the backend and frontend in separate terminals.

Terminal 1 — Start Python Backend

Open VS Code terminal.

Navigate to backend folder:
cd backend

Activate virtual environment:
venv\Scripts\activate

Start FastAPI server:
uvicorn main:app --reload

You should see:
“Connected to Blockchain!”
and
http://127.0.0.1:8000

Terminal 2 — Start React Frontend

Open a new terminal.

Navigate to frontend folder:
cd frontend

Start frontend:
npm run dev

Open http://localhost:5173
 in your browser.

🧩 5. GAME EXECUTION AND ITEM LOGIC
🧲 Magnet

Consumed after one run (win or lose).

Must be repurchased for next run.

🛡️ Shield

Stays with the player on a successful win.

Only consumed if the player hits a wall.

🚀 NFT Hoverboard

Permanent upgrade.

Grants:
• lower gravity
• faster jump
• 2x coin multiplier

Never consumed.