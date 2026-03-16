import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

interface ShortLinkData {
  full_url: string;
  brand: string;
  campaign_slug: string;
  channel: string;
  created_at: string;
}

export async function storeShortLink(
  code: string,
  data: ShortLinkData
): Promise<void> {
  await redis.set(`short:${code}`, JSON.stringify(data));
}

export async function lookupShortLink(
  code: string
): Promise<ShortLinkData | null> {
  const raw = await redis.get<string>(`short:${code}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function codeExists(code: string): Promise<boolean> {
  const result = await redis.exists(`short:${code}`);
  return result === 1;
}
