import { NextRequest, NextResponse } from "next/server";
import { createUser, createSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    if (!name?.trim() || !email?.trim() || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const result = await createUser(name, email, password);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    // Auto-login after signup
    const { verifyUser } = await import("@/lib/auth");
    const login = await verifyUser(email, password);
    if (login.success && login.user) {
      await createSession(login.user.id, login.user.email, login.user.name);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
