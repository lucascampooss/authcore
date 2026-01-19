import bcrypt from 'bcrypt';

// use lower rounds for token hashing (faster, still secure for short-lived tokens)
export async function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, 10);
}

export async function compareToken(token: string, hash: string): Promise<boolean> {
  return bcrypt.compare(token, hash);
}
