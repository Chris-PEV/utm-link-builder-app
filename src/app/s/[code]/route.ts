import { NextRequest, NextResponse } from "next/server";
import { lookupShortLink } from "@/lib/kv";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const data = await lookupShortLink(code);

    if (!data) {
      return new NextResponse("Link not found", { status: 404 });
    }

    return NextResponse.redirect(data.full_url, 307);
  } catch (error) {
    console.error("Redirect error:", error);
    return new NextResponse("Redirect service temporarily unavailable", {
      status: 503,
    });
  }
}
