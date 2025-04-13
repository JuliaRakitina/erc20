import { expect } from "chai";
import { ethers } from "hardhat";

describe("JToken", function () {
  let JToken: any;
  let token: any;
  let owner: any;
  let addr1: any;
  let addr2: any;

  const initialSupply = ethers.parseUnits("1000", 18);

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    JToken = await ethers.getContractFactory("JToken");
    token = await JToken.deploy(initialSupply);
    await token.waitForDeployment();
  });

  it("Should deploy with correct name and symbol", async function () {
    expect(await token.name()).to.equal("JToken");
    expect(await token.symbol()).to.equal("JTK");
  });

  it("Should assign initial supply to owner", async function () {
    const balance = await token.balanceOf(owner.address);
    expect(balance).to.equal(initialSupply);
  });

  it("Should allow transfer between accounts", async function () {
    await token.transfer(addr1.address, ethers.parseUnits("100", 18));
    const balance = await token.balanceOf(addr1.address);
    expect(balance).to.equal(ethers.parseUnits("100", 18));
  });

  it("Should fail if sender doesn’t have enough tokens", async function () {
    await expect(
      token.connect(addr1).transfer(owner.address, ethers.parseUnits("1", 18))
    ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
  });

  it("Should approve tokens for delegated transfer", async function () {
    await token.approve(addr1.address, ethers.parseUnits("200", 18));
    const allowance = await token.allowance(owner.address, addr1.address);
    expect(allowance).to.equal(ethers.parseUnits("200", 18));
  });

  it("Should allow transferFrom using allowance", async function () {
    await token.approve(addr1.address, ethers.parseUnits("50", 18));
    await token
      .connect(addr1)
      .transferFrom(owner.address, addr2.address, ethers.parseUnits("50", 18));

    expect(await token.balanceOf(addr2.address)).to.equal(
      ethers.parseUnits("50", 18)
    );
    const remaining = await token.allowance(owner.address, addr1.address);
    expect(remaining).to.equal(0);
  });

  it("Should fail transferFrom without enough allowance", async function () {
    await token.approve(addr1.address, ethers.parseUnits("10", 18));
    await expect(
      token
        .connect(addr1)
        .transferFrom(owner.address, addr2.address, ethers.parseUnits("20", 18))
    ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
  });

  it("Should allow owner to mint tokens", async function () {
    await token.mint(addr1.address, ethers.parseUnits("500", 18));
    expect(await token.balanceOf(addr1.address)).to.equal(
      ethers.parseUnits("500", 18)
    );
  });

  it("Should not allow non-owner to mint", async function () {
    await expect(
      token.connect(addr1).mint(addr2.address, ethers.parseUnits("500", 18))
    ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
  });
});
