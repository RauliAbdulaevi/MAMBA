export function getUsernameValidationError(username) {
  const normalizedUsername = typeof username === 'string' ? username.trim() : ''
  if (!normalizedUsername) {
    return { field: 'username', message: 'Username is required.', action: 'Enter a username to continue.' }
  }
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(normalizedUsername)) {
    return {
      field: 'username',
      message: 'Username must be 3 to 32 characters.',
      action: 'Use letters, numbers, dots, dashes, or underscores.'
    }
  }
  return null
}

export function getPasswordValidationError(password) {
  const normalizedPassword = typeof password === 'string' ? password.trim() : ''
  if (!normalizedPassword) {
    return { field: 'password', message: 'Password is required.', action: 'Enter a password to continue.' }
  }
  if (normalizedPassword.length < 10) {
    return {
      field: 'password',
      message: 'Password must be at least 10 characters.',
      action: 'Use a longer password before creating a wallet.'
    }
  }
  return null
}

export function getCredentialValidationError(username, password) {
  return getUsernameValidationError(username) || getPasswordValidationError(password)
}

export function getRegistrationValidationError({ username, password, confirmPassword }) {
  const usernameError = getUsernameValidationError(username)
  if (usernameError) return usernameError
  const passwordError = getPasswordValidationError(password)
  if (passwordError) return passwordError
  if (!confirmPassword) {
    return { field: 'confirmPassword', message: 'Confirm your password.', action: 'Enter the same password again.' }
  }
  if (password !== confirmPassword) {
    return { field: 'confirmPassword', message: 'Passwords do not match.', action: 'Check both password fields and try again.' }
  }
  return null
}

export const walletAvatarPresets = ['mamba', 'orbit', 'fang', 'mono']

export function getWalletNameValidationError(name) {
  const value = typeof name === 'string' ? name.trim() : ''
  if (!value) return { field: 'name', message: 'Wallet name is required.' }
  if (value.length > 32) return { field: 'name', message: 'Wallet name must be 32 characters or fewer.' }
  if (/[<>\u0000-\u001f\u007f]/.test(value)) return { field: 'name', message: 'Wallet name contains unsupported characters.' }
  return null
}

export function getWalletAvatarImageValidationError(image) {
  if (image == null || image === '') return null
  const match = typeof image === 'string' && /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/.exec(image)
  if (!match || image.length > 150_000) {
    return { field: 'avatarImage', message: 'Choose a PNG, JPEG, or WebP image under 110 KB after cropping.' }
  }
  try {
    const decoded = globalThis.atob(match[2])
    const mime = match[1]
    const signatureValid = mime === 'png'
      ? decoded.startsWith('\x89PNG\r\n\x1a\n')
      : mime === 'jpeg'
        ? decoded.startsWith('\xff\xd8\xff')
        : decoded.startsWith('RIFF') && decoded.slice(8, 12) === 'WEBP'
    if (!signatureValid) throw new Error('Image signature does not match its type.')
  } catch {
    return { field: 'avatarImage', message: 'Choose a valid PNG, JPEG, or WebP image under 110 KB after cropping.' }
  }
  return null
}

export function normalizeAddressForComparison(chain, address) {
  const value = typeof address === 'string' ? address.trim() : ''
  if (chain === 'evm') return value.toLowerCase()
  if (chain === 'bitcoin' && /^(bc1|tb1|bcrt1)/i.test(value)) return value.toLowerCase()
  return value
}

export function getContactMatch(contacts, chain, address) {
  const value = normalizeAddressForComparison(chain, address)
  if (!value) return { status: 'empty', contact: null }

  const savedContact = contacts.find((contact) => (
    contact.chain === chain && normalizeAddressForComparison(chain, contact.address) === value
  ))
  if (savedContact) return { status: 'saved', contact: savedContact }

  const otherNetworkContact = contacts.find((contact) => (
    contact.chain !== chain &&
    normalizeAddressForComparison(contact.chain, contact.address) === normalizeAddressForComparison(contact.chain, address)
  ))
  if (otherNetworkContact) return { status: 'other-network', contact: otherNetworkContact }
  return { status: 'new', contact: null }
}

export function getContactAddress(contacts, contactId) {
  return contacts.find((contact) => contact.id === contactId)?.address || ''
}
