import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

test('wallet profiles can be added, switched, edited, and reloaded without changing encrypted keys', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mamba-wallet-profile-'))
  const previousDataDir = process.env.MAMBA_DATA_DIR
  process.env.MAMBA_DATA_DIR = tempDir

  let server
  try {
    const [{ app }, WDK] = await Promise.all([
      import('../apps/api/src/app.js'),
      import('@tetherto/wdk')
    ])
    server = await new Promise((resolve) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener))
    })

    const baseUrl = `http://127.0.0.1:${server.address().port}`
    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: `profile-${Date.now()}`,
        password: 'TestPassphrase123!',
        mnemonic: WDK.default.getRandomSeedPhrase(12)
      })
    })
    assert.equal(registerResponse.status, 201)
    let cookie = registerResponse.headers.get('set-cookie')?.split(';')[0]
    assert.ok(cookie)

    const storePath = path.join(tempDir, 'users.json')
    const registered = await registerResponse.json()
    const legacyStore = JSON.parse(await fs.readFile(storePath, 'utf8'))
    const legacyUser = legacyStore.users[0]
    legacyUser.seedVault = legacyUser.wallets[0].seedVault
    legacyUser.backupConfirmed = legacyUser.wallets[0].backupConfirmed
    delete legacyUser.wallets
    delete legacyUser.activeWalletId
    await fs.writeFile(storePath, JSON.stringify(legacyStore))

    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: registered.user.username, password: 'TestPassphrase123!' })
    })
    assert.equal(loginResponse.status, 200)
    const loginData = await loginResponse.json()
    assert.equal(loginData.user.walletProfiles.length, 1)
    assert.equal(loginData.user.activeWalletId, 'wallet-default')
    cookie = loginResponse.headers.get('set-cookie')?.split(';')[0]
    assert.ok(cookie)

    const request = async (route, options = {}) => {
      const response = await fetch(`${baseUrl}${route}`, {
        headers: { 'content-type': 'application/json', cookie, ...(options.headers || {}) },
        ...options
      })
      return { response, data: await response.json() }
    }

    const firstWalletId = loginData.user.activeWalletId
    const { data: rejectedAdd, response: rejectedResponse } = await request('/api/wallet-profiles', {
      method: 'POST',
      body: JSON.stringify({ name: 'Vault', password: 'wrong-password' })
    })
    assert.equal(rejectedResponse.status, 400)
    assert.match(rejectedAdd.message, /re-authentication/i)

    const { data: added, response: addResponse } = await request('/api/wallet-profiles', {
      method: 'POST',
      body: JSON.stringify({ name: 'Vault', password: 'TestPassphrase123!' })
    })
    assert.equal(addResponse.status, 201)
    assert.equal(added.user.walletProfiles.length, 2)
    assert.equal(added.user.activeWalletId, added.wallet.id)
    assert.equal(Object.hasOwn(added.wallet, 'seedVault'), false)
    assert.equal(Object.hasOwn(added.wallet, 'mnemonic'), false)

    const importedPhrase = WDK.default.getRandomSeedPhrase(12)
    const { data: imported, response: importResponse } = await request('/api/wallet-profiles', {
      method: 'POST',
      body: JSON.stringify({ name: 'Imported', password: 'TestPassphrase123!', mnemonic: importedPhrase })
    })
    assert.equal(importResponse.status, 201)
    assert.equal(imported.wallet.backupConfirmed, true)
    assert.equal(imported.user.walletProfiles.length, 3)
    assert.equal(Object.hasOwn(imported.wallet, 'mnemonic'), false)
    assert.equal(JSON.stringify(imported).includes(importedPhrase), false)
    assert.equal(JSON.stringify(imported).includes('ciphertext'), false)

    const beforeEdit = JSON.parse(await fs.readFile(storePath, 'utf8'))
    beforeEdit.users[0].activity = [{ id: 'existing-activity', walletId: added.wallet.id, type: 'send', amount: '0.1' }]
    await fs.writeFile(storePath, JSON.stringify(beforeEdit))
    const createdWallet = beforeEdit.users[0].wallets.find((wallet) => wallet.id === added.wallet.id)
    const encryptedSeedBefore = structuredClone(createdWallet.seedVault)
    const avatarImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'
    const { response: editResponse, data: edited } = await request(`/api/wallet-profiles/${added.wallet.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Travel', avatarPreset: null, avatarImage })
    })
    assert.equal(editResponse.status, 200)
    assert.equal(edited.wallet.name, 'Travel')
    assert.equal(edited.wallet.avatarImage, avatarImage)

    const afterEdit = JSON.parse(await fs.readFile(storePath, 'utf8'))
    const editedWallet = afterEdit.users[0].wallets.find((wallet) => wallet.id === added.wallet.id)
    assert.deepEqual(editedWallet.seedVault, encryptedSeedBefore)
    assert.deepEqual(afterEdit.users[0].activity, beforeEdit.users[0].activity)

    const { response: switchResponse } = await request('/api/wallet-profiles/active', {
      method: 'POST',
      body: JSON.stringify({ walletId: firstWalletId })
    })
    assert.equal(switchResponse.status, 200)

    const { response: refreshResponse, data: refreshed } = await request('/api/auth/me')
    assert.equal(refreshResponse.status, 200)
    assert.equal(refreshed.user.activeWalletId, firstWalletId)
    assert.equal(refreshed.user.walletProfiles.find((wallet) => wallet.id === added.wallet.id).name, 'Travel')
  } finally {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    if (previousDataDir === undefined) delete process.env.MAMBA_DATA_DIR
    else process.env.MAMBA_DATA_DIR = previousDataDir
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})
