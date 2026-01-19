// parse expiry strings like '7d', '24h', '60m' or milliseconds
export function calculateExpiry(expiry: string | number): Date {
  const expiresAt = new Date();

  if (typeof expiry === 'number') {
    expiresAt.setTime(expiresAt.getTime() + expiry);
  } else {
    const match = expiry.match(/^(\d+)([dhms])$/);
    if (!match) {
      throw new Error(`invalid expiry format: ${expiry}`);
    }

    const value = match[1];
    const unit = match[2];

    if (!value || !unit) {
      throw new Error(`invalid expiry format: ${expiry}`);
    }

    const num = parseInt(value, 10);

    switch (unit) {
      case 'd':
        expiresAt.setDate(expiresAt.getDate() + num);
        break;
      case 'h':
        expiresAt.setHours(expiresAt.getHours() + num);
        break;
      case 'm':
        expiresAt.setMinutes(expiresAt.getMinutes() + num);
        break;
      case 's':
        expiresAt.setSeconds(expiresAt.getSeconds() + num);
        break;
    }
  }

  return expiresAt;
}

// calculate new expiry for sliding tokens respecting maximum age
export function calculateSlidingExpiry(
  _currentExpiry: Date,
  createdAt: Date,
  refreshExpiry: string | number,
  maxAge?: string | number
): Date {
  const newExpiry = calculateExpiry(refreshExpiry);

  if (!maxAge) {
    return newExpiry;
  }

  const maxExpiry = new Date(createdAt);
  if (typeof maxAge === 'number') {
    maxExpiry.setTime(maxExpiry.getTime() + maxAge);
  } else {
    const match = maxAge.match(/^(\d+)([dhms])$/);
    if (match) {
      const num = parseInt(match[1]!, 10);
      const unit = match[2];
      switch (unit) {
        case 'd':
          maxExpiry.setDate(maxExpiry.getDate() + num);
          break;
        case 'h':
          maxExpiry.setHours(maxExpiry.getHours() + num);
          break;
        case 'm':
          maxExpiry.setMinutes(maxExpiry.getMinutes() + num);
          break;
        case 's':
          maxExpiry.setSeconds(maxExpiry.getSeconds() + num);
          break;
      }
    }
  }

  return newExpiry < maxExpiry ? newExpiry : maxExpiry;
}
