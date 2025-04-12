import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying with address:", deployer.address);

    const initialSupply = "1000";
    const Token = await ethers.getContractFactory("JToken");
    const token = await Token.deploy(ethers.parseUnits(initialSupply, 18));

    await token.waitForDeployment();
    const address = await token.getAddress();

    console.log("✅ Token deployed to:", address);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
