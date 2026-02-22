import * as Crypto from 'expo-crypto';

export async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

export async function verifyPin(
  pin: string,
  hash: string
): Promise<boolean> {
  const inputHash = await hashPin(pin);
  return inputHash === hash;
}
