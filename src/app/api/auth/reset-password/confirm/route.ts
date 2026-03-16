import { NextRequest, NextResponse } from "next/server";
import { verifyResetToken, consumeResetToken, updateUserPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and new password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const email = await verifyResetToken(token);
    if (!email) {
      return NextResponse.json(
        { error: "Invalid or expired reset link. Please request a new one." },
        { status: 400 }
      );
    }

    const updated = await updateUserPassword(email, password);
    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update password" },
        { status: 500 }
      );
    }

    await consumeResetToken(token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset confirm error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
