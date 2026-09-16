import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('JToken', function () {
  const initialSupply = ethers.parseUnits('1000', 18);
  const amount = (value: string) => ethers.parseUnits(value, 18);

  async function deployToken() {
    const [owner, spender, recipient] = await ethers.getSigners();
    const factory = await ethers.getContractFactory('JToken');
    const token = await factory.deploy(owner.address, initialSupply);
    await token.waitForDeployment();
    return { token, factory, owner, spender, recipient };
  }

  it('reports its name, symbol, and decimals', async function () {
    const { token } = await loadFixture(deployToken);
    expect(await token.name()).to.equal('JToken');
    expect(await token.symbol()).to.equal('JTK');
    expect(await token.decimals()).to.equal(18n);
  });

  it('assigns ownership and initial supply to the explicit owner', async function () {
    const { factory, owner, recipient } = await loadFixture(deployToken);
    const token = await factory.deploy(recipient.address, initialSupply);
    expect(await token.owner()).to.equal(recipient.address);
    expect(await token.totalSupply()).to.equal(initialSupply);
    expect(await token.balanceOf(recipient.address)).to.equal(initialSupply);
    expect(await token.balanceOf(owner.address)).to.equal(0n);
  });

  it('emits a mint Transfer event for the initial supply', async function () {
    const { factory, owner } = await loadFixture(deployToken);
    const token = await factory.deploy(owner.address, initialSupply);
    await expect(token.deploymentTransaction())
      .to.emit(token, 'Transfer')
      .withArgs(ethers.ZeroAddress, owner.address, initialSupply);
  });

  it('allows an initial supply of zero', async function () {
    const { factory, owner } = await loadFixture(deployToken);
    const token = await factory.deploy(owner.address, 0n);
    expect(await token.totalSupply()).to.equal(0n);
    expect(await token.balanceOf(owner.address)).to.equal(0n);
  });

  it('rejects a zero initial owner', async function () {
    const { factory, token } = await loadFixture(deployToken);
    await expect(factory.deploy(ethers.ZeroAddress, initialSupply))
      .to.be.revertedWithCustomError(token, 'OwnableInvalidOwner')
      .withArgs(ethers.ZeroAddress);
  });

  it('lets the owner mint and emits the corresponding Transfer', async function () {
    const { token, recipient } = await loadFixture(deployToken);
    await expect(token.mint(recipient.address, amount('5.25')))
      .to.emit(token, 'Transfer')
      .withArgs(ethers.ZeroAddress, recipient.address, amount('5.25'));
    expect(await token.balanceOf(recipient.address)).to.equal(amount('5.25'));
    expect(await token.totalSupply()).to.equal(initialSupply + amount('5.25'));
  });

  it('rejects minting by a non-owner', async function () {
    const { token, spender, recipient } = await loadFixture(deployToken);
    await expect(
      token.connect(spender).getFunction('mint')(
        recipient.address,
        amount('1'),
      ),
    )
      .to.be.revertedWithCustomError(token, 'OwnableUnauthorizedAccount')
      .withArgs(spender.address);
    expect(await token.totalSupply()).to.equal(initialSupply);
  });

  it('transfers exact units, updates both balances, and emits Transfer', async function () {
    const { token, owner, recipient } = await loadFixture(deployToken);
    const units = amount('1.000000000000000001');
    await expect(token.transfer(recipient.address, units))
      .to.emit(token, 'Transfer')
      .withArgs(owner.address, recipient.address, units);
    expect(await token.balanceOf(owner.address)).to.equal(
      initialSupply - units,
    );
    expect(await token.balanceOf(recipient.address)).to.equal(units);
    expect(await token.totalSupply()).to.equal(initialSupply);
  });

  it("rejects a transfer exceeding the sender's balance", async function () {
    const { token, spender, recipient } = await loadFixture(deployToken);
    await expect(
      token.connect(spender).getFunction('transfer')(
        recipient.address,
        amount('1'),
      ),
    )
      .to.be.revertedWithCustomError(token, 'ERC20InsufficientBalance')
      .withArgs(spender.address, 0n, amount('1'));
  });

  it('records an approval and emits Approval', async function () {
    const { token, owner, spender } = await loadFixture(deployToken);
    await expect(token.approve(spender.address, amount('10')))
      .to.emit(token, 'Approval')
      .withArgs(owner.address, spender.address, amount('10'));
    expect(await token.allowance(owner.address, spender.address)).to.equal(
      amount('10'),
    );
  });

  it('replaces an existing allowance when the owner approves again', async function () {
    const { token, owner, spender } = await loadFixture(deployToken);
    await token.approve(spender.address, amount('10'));
    await token.approve(spender.address, amount('3'));
    expect(await token.allowance(owner.address, spender.address)).to.equal(
      amount('3'),
    );
  });

  it('lets the approved spender transfer from the owner and reduces allowance', async function () {
    const { token, owner, spender, recipient } = await loadFixture(deployToken);
    await token.approve(spender.address, amount('10'));
    await expect(
      token.connect(spender).getFunction('transferFrom')(
        owner.address,
        recipient.address,
        amount('3'),
      ),
    )
      .to.emit(token, 'Transfer')
      .withArgs(owner.address, recipient.address, amount('3'));
    expect(await token.balanceOf(owner.address)).to.equal(amount('997'));
    expect(await token.balanceOf(recipient.address)).to.equal(amount('3'));
    expect(await token.balanceOf(spender.address)).to.equal(0n);
    expect(await token.allowance(owner.address, spender.address)).to.equal(
      amount('7'),
    );
  });

  it('rejects transferFrom with insufficient allowance and preserves state', async function () {
    const { token, owner, spender, recipient } = await loadFixture(deployToken);
    await token.approve(spender.address, amount('2'));
    await expect(
      token.connect(spender).getFunction('transferFrom')(
        owner.address,
        recipient.address,
        amount('3'),
      ),
    )
      .to.be.revertedWithCustomError(token, 'ERC20InsufficientAllowance')
      .withArgs(spender.address, amount('2'), amount('3'));
    expect(await token.balanceOf(owner.address)).to.equal(initialSupply);
    expect(await token.balanceOf(recipient.address)).to.equal(0n);
    expect(await token.allowance(owner.address, spender.address)).to.equal(
      amount('2'),
    );
  });

  it('rejects transferFrom with insufficient owner balance and restores allowance', async function () {
    const { token, owner, spender, recipient } = await loadFixture(deployToken);
    await token.approve(spender.address, initialSupply + 1n);
    await expect(
      token.connect(spender).getFunction('transferFrom')(
        owner.address,
        recipient.address,
        initialSupply + 1n,
      ),
    )
      .to.be.revertedWithCustomError(token, 'ERC20InsufficientBalance')
      .withArgs(owner.address, initialSupply, initialSupply + 1n);
    expect(await token.allowance(owner.address, spender.address)).to.equal(
      initialSupply + 1n,
    );
  });

  it('rejects minting to the zero address', async function () {
    const { token } = await loadFixture(deployToken);
    await expect(token.mint(ethers.ZeroAddress, 1n))
      .to.be.revertedWithCustomError(token, 'ERC20InvalidReceiver')
      .withArgs(ethers.ZeroAddress);
  });

  it('rejects transferring to the zero address', async function () {
    const { token } = await loadFixture(deployToken);
    await expect(token.transfer(ethers.ZeroAddress, 1n))
      .to.be.revertedWithCustomError(token, 'ERC20InvalidReceiver')
      .withArgs(ethers.ZeroAddress);
  });
});
