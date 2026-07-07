import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function productConfigPath(installRoot) {
  return path.join(installRoot, "config", "product.json");
}

export function loadProductConfig(installRoot) {
  const file = productConfigPath(installRoot);
  if (!existsSync(file)) return {};
  const raw = readFileSync(file, "utf8");
  const parsed = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
  return sanitizeProductConfig(parsed);
}

export function sanitizeProductConfig(value = {}) {
  const relayUrl = String(value.relayUrl ?? "").trim();
  const webUrl = String(value.webUrl ?? "").trim();
  return {
    ...(relayUrl ? { relayUrl } : {}),
    ...(webUrl ? { webUrl } : {}),
  };
}
