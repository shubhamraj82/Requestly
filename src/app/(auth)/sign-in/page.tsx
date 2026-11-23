import { googleProvider } from "@/lib/env";
import SignInForm from "./sign-in-form";

export default function LoginPage() {
  return <SignInForm googleEnabled={Boolean(googleProvider)} />;
}
