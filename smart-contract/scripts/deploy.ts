import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with address:", deployer.address);

  const initialSupply = "1000";
  const Token = await ethers.getContractFactory("JToken");
  const token = await Token.deploy(ethers.parseUnits(initialSupply, 18));

  await token.waitForDeployment();
  const address = await token.getAddress();

  console.log("✅ Token deployed to:", address);

  const output = {
    address,
  };
  const filePath = path.join(__dirname, "../deployed/contract-address.json");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(output, null, 2));

  console.log("📦 Contract address saved to:", filePath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
