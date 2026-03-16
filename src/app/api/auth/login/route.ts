import { NextRequest, NextResponse } from "next/server";
import { verifyUser, createSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email?.trim() || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const result = await verifyUser(email, password);
    if (!result.success || !result.user) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    await createSession(result.user.id, result.user.email, result.user.name);

    return NextResponse.json({ success: true, user: { name: result.user.name, email: result.user.email } });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
