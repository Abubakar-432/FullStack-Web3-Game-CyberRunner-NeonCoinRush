import json
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from web3 import Web3
from dotenv import load_dotenv

# Load the secret keys from .env
load_dotenv()

app = FastAPI()

# Allow React to talk to this Python server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- BLOCKCHAIN SETUP ---
try:
    # Connect to Sepolia
    rpc_url = os.getenv("RPC_URL")
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    
    # Check connection
    if w3.is_connected():
        print(f"✅ Connected to Blockchain! Block Number: {w3.eth.block_number}")
    else:
        print("❌ Failed to connect to Blockchain.")

    # Load Wallet & Contract
    private_key = os.getenv("PRIVATE_KEY")
    account = w3.eth.account.from_key(private_key)
    
    contract_address = os.getenv("CONTRACT_ADDRESS")
    contract_abi = json.loads(os.getenv("CONTRACT_ABI"))
    
    contract = w3.eth.contract(address=contract_address, abi=contract_abi)
    print(f"✅ Contract Loaded: {contract_address}")

except Exception as e:
    print(f"❌ Error loading blockchain config: {e}")


# --- DATA MODEL (What React sends us) ---
class RunData(BaseModel):
    player_address: str
    result: str         # "win" or "fail"
    coins_collected: int = 0


# --- THE API ENDPOINT ---
@app.post("/submit-run")
async def submit_run(data: RunData):
    print(f"🎮 Received Run: {data.player_address} | Result: {data.result} | Coins: {data.coins_collected}")
    
    try:
        # 1. Prepare the Transaction
        nonce = w3.eth.get_transaction_count(account.address)
        
        if data.result == "win":
            # Call completeRun(player, coins)
            tx_func = contract.functions.completeRun(data.player_address, data.coins_collected)
        else:
            # Call failRun(player)
            tx_func = contract.functions.failRun(data.player_address)

        # 2. Build the Transaction (Gas Settings)
        tx = tx_func.build_transaction({
            'from': account.address,
            'nonce': nonce,
            'gas': 200000, 
            'maxFeePerGas': w3.to_wei('50', 'gwei'),
            'maxPriorityFeePerGas': w3.to_wei('2', 'gwei'),
        })
        
        # 3. Sign & Send
        signed_tx = w3.eth.account.sign_transaction(tx, private_key)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        
        print(f"🚀 Transaction Sent! Hash: {tx_hash.hex()}")
        return {"status": "success", "tx_hash": tx_hash.hex()}
    
    except Exception as e:
        print(f"❌ Transaction Failed: {e}")
        return {"status": "error", "message": str(e)}

# Simple test to check if server is running
@app.get("/")
def home():
    return {"message": "CyberRunner Backend is Online!"}