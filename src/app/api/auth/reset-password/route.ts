import { NextRequest, NextResponse } from "next/server";
import { createResetToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Always return success to prevent email enumeration
    const token = await createResetToken(email);

    if (token) {
      // In production, send an email with the reset link
      // For now, log the token (the reset-password/confirm page handles the flow)
      const origin = request.headers.get("x-forwarded-host")
        ? `https://${request.headers.get("x-forwarded-host")}`
        : request.nextUrl.origin;
      console.log(`Password reset link: ${origin}/reset-password?token=${token}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
