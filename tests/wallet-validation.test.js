import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getContactAddress,
  getContactMatch,
  getCredentialValidationError,
  getRegistrationValidationError
} from '../shared/wallet-validation.js'

const evmAddress = '0xAbCd000000000000000000000000000000001234'

test('matches a saved EVM address on the selected network, ignoring case and whitespace', () => {
  const contact = { id: 'contact-1', name: 'Vault', chain: 'evm', address: evmAddress }
  assert.deepEqual(getContactMatch([contact], 'evm', `  ${evmAddress.toLowerCase()}  `), {
    status: 'saved',
    contact
  })
})

test('recognizes the same saved address on another network without trusting it', () => {
  const contact = { id: 'contact-1', name: 'Vault', chain: 'solana', address: 'AbCdEf123' }
  assert.deepEqual(getContactMatch([contact], 'evm', 'AbCdEf123'), {
    status: 'other-network',
    contact
  })
})

test('normalizes Bitcoin Bech32 case but preserves Base58 case', () => {
  const bech32 = { id: 'btc-1', name: 'BTC', chain: 'bitcoin', address: 'tb1qexampleaddress' }
  assert.equal(getContactMatch([bech32], 'bitcoin', ' TB1QEXAMPLEADDRESS ').status, 'saved')

  const base58 = { ...bech32, address: 'mAbC123' }
  assert.equal(getContactMatch([base58], 'bitcoin', 'MABC123').status, 'new')
})

test('keeps Solana Base58 comparisons case-sensitive and trims whitespace', () => {
  const contact = { id: 'sol-1', name: 'SOL', chain: 'solana', address: 'AbCdEf123' }
  assert.equal(getContactMatch([contact], 'solana', ' AbCdEf123 ').status, 'saved')
  assert.equal(getContactMatch([contact], 'solana', 'abcdef123').status, 'new')
})

test('resolves a selected contact ID to its saved address', () => {
  const contacts = [
    { id: 'one', address: 'first-address' },
    { id: 'two', address: 'selected-address' }
  ]
  assert.equal(getContactAddress(contacts, 'two'), 'selected-address')
  assert.equal(getContactAddress(contacts, ''), '')
})

test('rejects mismatched registration passwords', () => {
  assert.equal(getRegistrationValidationError({
    username: 'rauli',
    password: 'correct-horse-battery',
    confirmPassword: 'different-password-value'
  })?.message, 'Passwords do not match.')
})

test('server credential validation enforces the same username and password rules', () => {
  assert.equal(getCredentialValidationError('rauli', 'TestPassword123!'), null)
  assert.equal(getCredentialValidationError('x', 'TestPassword123!')?.field, 'username')
  assert.equal(getCredentialValidationError('rauli', 'short')?.field, 'password')
})
