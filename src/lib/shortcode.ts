const CHANNEL_ABBREV: Record<string, string> = {
  Facebook: "fb",
  Instagram: "ig",
  "X / Twitter": "tw",
  LinkedIn: "li",
  "Google Ads": "gads",
  Email: "em",
  TikTok: "tt",
  YouTube: "yt",
};

function slugifyBrand(brand: string): string {
  return brand
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 10);
}

function abbreviateCampaign(slug: string): string {
  // Extract year digits if present (e.g., "spring_sale_2026" → "2026")
  const yearMatch = slug.match(/(\d{4})/);
  const yearSuffix = yearMatch ? yearMatch[1].slice(2) : "";

  // Take first word, up to 8 chars
  const firstWord = slug.split("_")[0].slice(0, 8);

  return yearSuffix ? `${firstWord}${yearSuffix}` : firstWord.slice(0, 10);
}

export function generateShortCode(
  brand: string,
  campaignSlug: string,
  channel: string
): string {
  const brandPart = slugifyBrand(brand);
  const campaignPart = abbreviateCampaign(campaignSlug);
  const channelPart = CHANNEL_ABBREV[channel] || channel.slice(0, 3).toLowerCase();

  if (brandPart) {
    return `${brandPart}-${campaignPart}-${channelPart}`;
  }
  return `${campaignPart}-${channelPart}`;
}
