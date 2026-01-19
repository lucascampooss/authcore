// validate jwt secret strength
export function validateSecret(secret: string, name: string): void {
  if (!secret || typeof secret !== 'string') {
    throw new Error(`${name} is required and must be a string`);
  }

  if (secret.length < 32) {
    throw new Error(`${name} must be at least 32 characters long for security`);
  }

  // check for common weak secrets
  const weakSecrets = ['secret', 'password', 'test', 'admin', 'default', '12345'];
  const lowerSecret = secret.toLowerCase();

  for (const weak of weakSecrets) {
    if (lowerSecret.includes(weak)) {
      throw new Error(`${name} contains weak pattern '${weak}' - use a strong random secret`);
    }
  }

  // check if it's only numbers
  if (/^[0-9]+$/.test(secret)) {
    throw new Error(`${name} cannot be numbers only - use a mix of characters`);
  }

  // check if it's only letters
  if (/^[a-zA-Z]+$/.test(secret)) {
    throw new Error(`${name} should include numbers and special characters for better security`);
  }
}

// validate token expiry format
export function validateExpiry(expiry: string | number, name: string): void {
  if (typeof expiry === 'number') {
    if (expiry <= 0) {
      throw new Error(`${name} must be a positive number`);
    }
    return;
  }

  const match = expiry.match(/^(\d+)([dhms])$/);
  if (!match) {
    throw new Error(`${name} must be in format like '15m', '7d', '24h', or milliseconds`);
  }

  const value = parseInt(match[1]!, 10);
  if (value <= 0) {
    throw new Error(`${name} must be a positive value`);
  }
}
