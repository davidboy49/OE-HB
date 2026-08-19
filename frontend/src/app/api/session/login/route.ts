import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/apiClient";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json({ message: "email and password are required" }, { status: 400 });
  }

  const backendRes = await fetch(`${BACKEND_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: body.email, password: body.password }),
    cache: "no-store",
  });

  if (!backendRes.ok) {
    const payload = await backendRes.json().catch(() => ({ message: "Login failed" }));
    return NextResponse.json(payload, { status: backendRes.status });
  }

  const { accessToken, user } = await backendRes.json();

  const store = await cookies();
  store.set(AUTH_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // matches the backend JWT's 12h expiry
  });

  return NextResponse.json({ user });
}
