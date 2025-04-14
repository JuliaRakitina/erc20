# ERC20 Token Smart Contract + Viem Backend Integration

This project demonstrates a complete development and infrastructure setup for interacting with an ERC20 token smart contract via a NestJS backend powered by the `viem` library. The system includes contract deployment, a RESTful API interface, and full Docker-based orchestration.

---

## 🧩 Project Structure

```
erc20/
├── backend/              # NestJS API using viem
├── smart-contract/       # Solidity ERC20 contract + Hardhat setup
├── shared/               # Shared ABI and contract address
├── docker-compose.yml    # Unified local infrastructure
└── README.md             # This documentation
```

---

## ✨ Features

- ✅ ERC20-compliant token with:
    - `name`, `symbol`, `totalSupply`
    - `transfer`, `approve`, `transferFrom`
    - `mint` (onlyOwner)
- ✅ Viem-based interaction (no ethers.js)
- ✅ NestJS REST API:
    - `GET /token/info`
    - `GET /token/balance?address=...`
    - `POST /token/transfer`
    - `POST /token/mint`
    - `POST /token/approve`
    - `GET /token/allowance`
    - `POST /token/transfer-from`
- ✅ Comprehensive unit tests (Hardhat + chai)
- ✅ Docker-based local blockchain + backend
- ✅ Runtime & memory limits enforced (per spec)

---

## 🚀 Quick Start (One Command)

```bash
docker compose up --build
```

➡️ This will:

1. Start a local Hardhat node
2. Deploy the ERC20 smart contract
3. Share the ABI + address to a mounted volume
4. Launch the NestJS backend and expose port `3000`

---

## 📦 Usage Examples

### Get Token Info
```http
GET http://localhost:3000/token/info
```

### Transfer Tokens
```http
POST http://localhost:3000/token/transfer
Content-Type: application/json

{
  "to": "0x7099...",
  "amount": "10",
  "privateKey": "0xac09..."
}
```

### Mint Tokens
```http
POST http://localhost:3000/token/mint
Content-Type: application/json

{
  "to": "0x3C44...",
  "amount": "50",
  "privateKey": "0xac09..." // must be contract owner
}
```

---

## 🛠️ Design Decisions

- **Viem over ethers.js**: chosen for modern performance and full typescript-native flow.
- **Shared ABI and address**: automatically saved to `/shared` volume during deployment.
- **No `.env` files**: all configuration is static and demo-friendly.
- **Error handling**: custom messages for invalid keys, insufficient funds, zero amounts, etc.
- **Gas saving**: minimal transfer logic, no redundant calls.

---

## 🐳 Docker Infrastructure

The system is split into two services:

| Service         | Description                     | Port  |
|----------------|----------------------------------|-------|
| `smart-contract` | Hardhat local node + deployment | 8545  |
| `backend`        | NestJS API (Viem-based)         | 3000  |

### Volumes
- Shared volume `shared-data` is used to pass ABI and contract address from Hardhat to the backend.

---
## ⏱ Runtime Constraints

This project satisfies the required execution constraints:

- **Execution Time Limit:** All operations are designed to complete well within the required 4 seconds per shell execution.
- **Memory Limit:** All services operate efficiently under 2 GB memory.

Although this Docker Compose setup is optimized for low resource usage, **you can explicitly enforce memory limits at runtime** if needed.

### 🔒 Apply memory limits (optional)

To run the backend with a 2GB memory cap:

```bash
docker compose run --memory=2g backend
```
---

## 🧪 Test Coverage

Unit tests cover:

- ✅ `transfer`, `balanceOf`, `approve`, `allowance`, `transferFrom`
- ✅ `mint` (owner only)
- ✅ Negative scenarios:
    - Revert on transfer > balance
    - Revert on transferFrom without allowance
    - Revert mint from non-owner

Run tests manually:
```bash
cd smart-contract
npx hardhat test
```

> ✅ 18 passing tests, including edge cases and custom error reverts.

---

## 🧠 Final Notes

This repository is fully self-contained and showcases:

- Smart contract development
- Viem API integration
- Dockerized infrastructure
- Error handling & validation
- Production-grade project structure
- Developer-friendly one-command launch

---

Julia Rakitina julia.rakitina@gmail.com
