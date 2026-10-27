import { SignJWT, jwtVerify } from "jose";
import { SESSION_DURATION_DAYS } from "./constants";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

function secretKey() {
  const secret =
    process.env.AUTH_SECRET ?? "ensilla-dev-secret-change-me-please";
  return new TextEncoder().encode(secret);
}

export async function signSession(user: SessionUser) {
  return new SignJWT({
    name: user.name,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_DAYS}d`)
    .sign(secretKey());
}

export async function verifySession(
  token: string,
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      name: String(payload.name ?? ""),
      email: String(payload.email ?? ""),
      role: String(payload.role ?? "BARBER"),
    };
  } catch {
    return null;
  }
}
