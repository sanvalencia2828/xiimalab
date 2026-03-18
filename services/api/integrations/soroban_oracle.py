"""
Soroban Skill Oracle — Verifiable skill certification on the Stellar Network.
"""
import hashlib
import json
import os
import logging
from typing import Dict, Any, List
from datetime import datetime
from stellar_sdk import Server, Keypair, TransactionBuilder, Network

log = logging.getLogger("xiima.soroban_oracle")

STELLAR_NETWORK = os.environ.get("STELLAR_NETWORK", "TESTNET")
HORIZON_URL = "https://horizon-testnet.stellar.org" if STELLAR_NETWORK == "TESTNET" else "https://horizon.stellar.org"

class SorobanSkillOracle:
    """Verifies and records skills on the Stellar network (Soroban simulation)."""

    def __init__(self):
        self.server = Server(HORIZON_URL)
        self.proofs = {} # Still keeping local cache for speed

    async def generate_mastery_proof(self, user_address: str, roadmap_id: str, skills: List[str]) -> Dict[str, Any]:
        """
        Generates a verifiable proof of mastery.
        In production, this would sign a transaction that calls a Soroban contract.
        """
        mastery_data = {
            "user_address": user_address,
            "roadmap_id": roadmap_id,
            "skills": sorted(skills),
            "timestamp": datetime.now().isoformat(),
            "issuer": "Xiimalab Oracle v1",
            "network": STELLAR_NETWORK
        }

        # Create a deterministic fingerprint for the proof
        data_string = json.dumps(mastery_data, sort_keys=True)
        fingerprint = hashlib.sha256(data_string.encode()).hexdigest()

        # Mock a Stellar transaction hash
        mock_tx_hash = f"tx_{hashlib.md5(fingerprint.encode()).hexdigest()}"

        proof = {
            "mastery_data": mastery_data,
            "fingerprint": fingerprint,
            "transaction_hash": mock_tx_hash,
            "status": "verified",
            "explorer_url": f"https://stellar.expert/explorer/{STELLAR_NETWORK.lower()}/tx/{mock_tx_hash}"
        }

        # Store in local 'state' (this would be on-chain in Soroban)
        self.proofs[fingerprint] = proof
        
        log.info(f"Generated mastery proof for {user_address} on roadmap {roadmap_id}")
        return proof

    def verify_on_chain(self, fingerprint: str) -> bool:
        """Simulates checking the fingerprint against a Soroban smart contract."""
        return fingerprint in self.proofs

# Global instance
soroban_oracle = SorobanSkillOracle()