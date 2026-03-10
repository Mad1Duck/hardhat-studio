import keytar from "keytar";

const SERVICE = "hardhat-studio";

export async function setStorage(key: string, value: any) {
  await keytar.setPassword(SERVICE, key, JSON.stringify(value));
}

export async function getStorage<T>(key: string): Promise<T | null> {
  const value = await keytar.getPassword(SERVICE, key);
  if (!value) return null;
  return JSON.parse(value);
}

export async function deleteStorage(key: string) {
  await keytar.deletePassword(SERVICE, key);
}