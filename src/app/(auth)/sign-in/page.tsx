import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { googleProvider } from "@/lib/env";
import SignInForm from "./sign-in-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const callbackURL = (await searchParams).next === "join" ? "/join" : "/";
  if (await auth.api.getSession({ headers: await headers() }))
    redirect(callbackURL);
  return (
    <SignInForm
      googleEnabled={Boolean(googleProvider)}
      callbackURL={callbackURL}
    />
  );
}
