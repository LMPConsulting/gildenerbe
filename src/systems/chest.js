// Shared guild chest. Gear banked here persists across hero lives — a brand-new
// hero can pull from it (great for stashing off-class drops). It is destroyed
// only when the BASE itself falls (see chronik.destroyBase).
export const CHEST_MAX = 48;

export function ensureChest(account) {
  if (!Array.isArray(account.chest)) account.chest = [];
  return account.chest;
}

export function depositItem(account, hero, item) {
  ensureChest(account);
  const i = hero.inventory.indexOf(item);
  if (i < 0 || account.chest.length >= CHEST_MAX) return false;
  hero.inventory.splice(i, 1);
  account.chest.push(item);
  return true;
}

export function withdrawItem(account, hero, item) {
  ensureChest(account);
  const i = account.chest.indexOf(item);
  if (i < 0) return false;
  account.chest.splice(i, 1);
  hero.inventory.push(item);
  return true;
}
