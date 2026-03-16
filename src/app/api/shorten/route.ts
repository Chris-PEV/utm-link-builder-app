import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { generateShortCode } from "@/lib/shortcode";
import { storeShortLink, codeExists } from "@/lib/kv";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brand, full_url, campaign_slug, channel } = body;

    if (!full_url || !campaign_slug || !channel) {
      return NextResponse.json(
        { error: "Missing required fields: full_url, campaign_slug, channel" },
        { status: 400 }
      );
    }

    // Generate short code
    let code = generateShortCode(brand || "", campaign_slug, channel);

    // Check for collision, append suffix if needed
    let attempts = 0;
    let finalCode = code;
    while (await codeExists(finalCode) && attempts < 3) {
      finalCode = `${code}-${nanoid(3)}`;
      attempts++;
    }

    if (await codeExists(finalCode)) {
      // Extremely unlikely — fallback to pure random
      finalCode = nanoid(8);
    }

    // Store in KV
    await storeShortLink(finalCode, {
      full_url,
      brand: brand || "",
      campaign_slug,
      channel,
      created_at: new Date().toISOString(),
    });

    // Build short URL using request origin
    const origin = request.headers.get("x-forwarded-host")
      ? `https://${request.headers.get("x-forwarded-host")}`
      : request.nextUrl.origin;

    return NextResponse.json({
      short_code: finalCode,
      short_url: `${origin}/s/${finalCode}`,
    });
  } catch (error) {
    console.error("Shorten API error:", error);
    return NextResponse.json(
      { error: "Short link service temporarily unavailable" },
      { status: 500 }
    );
  }
}
