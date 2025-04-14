import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🔑 Deploying with address:", deployer.address);

  const initialSupply = ethers.parseUnits("1000", 18);
  const Token = await ethers.getContractFactory("JToken");
  const token = await Token.deploy(initialSupply);

  await token.waitForDeployment();
  const address = await token.getAddress();

  console.log("✅ Token deployed to:", address);

  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/JToken.sol/JToken.json"
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  const abi = artifact.abi;

  const outputDir = "/shared";
  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    `${outputDir}/contract-address.json`,
    JSON.stringify({ address }, null, 2)
  );
  fs.writeFileSync(`${outputDir}/abi.json`, JSON.stringify(abi, null, 2));

  console.log("📦 ABI and address saved to /shared");
}

main().catch((error) => {
  console.error("❌ Deployment error:", error);
  process.exitCode = 1;
});
