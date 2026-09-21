import { getSsoConfig } from "@/lib/sso";
import LoginClient from "./login-client";

export const metadata = {
  title: "Log in | OE Portal",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; ssoError?: string }>;
}) {
  const { from, ssoError } = await searchParams;
  return <LoginClient ssoEnabled={getSsoConfig() !== null} ssoError={ssoError ?? null} from={from ?? null} />;
}
