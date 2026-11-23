"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ArrowRight,
  Braces,
  Check,
  CircleDot,
  Command,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";

type Provider = "github" | "google";

export default function SignInForm({ googleEnabled, callbackURL }: { googleEnabled: boolean; callbackURL: string }) {
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);

  const handleSignIn = async (provider: Provider) => {
    setPendingProvider(provider);
    try {
      await signIn.social({ provider, callbackURL });
    } catch {
      toast.error("Could not start sign in. Please try again.");
      setPendingProvider(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#090b10] text-white lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden min-h-screen flex-col justify-between overflow-hidden border-r border-white/[0.08] bg-[#0d1018] p-10 lg:flex xl:p-14">
        <div className="pointer-events-none absolute -left-40 top-20 h-[30rem] w-[30rem] rounded-full bg-indigo-600/20 blur-[130px]" />
        <div className="pointer-events-none absolute -bottom-48 right-0 h-[34rem] w-[34rem] rounded-full bg-violet-500/10 blur-[140px]" />

        <a href="/sign-in" className="relative z-10 inline-flex w-fit items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-300/20 bg-indigo-400/10 text-indigo-300">
            <Braces className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Requestly</span>
        </a>

        <div className="relative z-10 mx-auto w-full max-w-xl py-12">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-300/15 bg-indigo-300/[0.06] px-3 py-1.5 text-xs font-medium text-indigo-200">
            <Sparkles className="h-3.5 w-3.5" />
            Your API workspace
          </div>
          <h1 className="max-w-lg text-4xl font-semibold leading-[1.12] tracking-tight xl:text-5xl">
            Make every API request feel effortless.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-400">
            Send requests, inspect responses, and keep your work organized in one
            focused workspace.
          </p>

          <div className="mt-10 rounded-2xl border border-white/10 bg-[#11141d]/90 p-4 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="flex items-center gap-2 border-b border-white/[0.07] pb-4">
              <CircleDot className="h-4 w-4 text-indigo-300" />
              <span className="text-sm font-medium text-slate-200">Request preview</span>
              <div className="ml-auto flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-400/80" />
                <span className="h-2 w-2 rounded-full bg-amber-300/80" />
                <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-3">
              <span className="rounded-md bg-emerald-400/10 px-2 py-1 text-[11px] font-bold tracking-wide text-emerald-300">GET</span>
              <span className="truncate font-mono text-xs text-slate-300">api.example.com/v1/projects</span>
              <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-indigo-300" />
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-[#0b0e15] px-3 py-3">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Check className="h-4 w-4 text-emerald-400" />
                Response received
              </div>
              <span className="font-mono text-xs text-emerald-300">200 OK · 128 ms</span>
            </div>
            <div className="mt-3 space-y-2 px-1 font-mono text-[11px] leading-5 text-slate-500">
              <p><span className="text-violet-300">&#123;</span></p>
              <p className="pl-4"><span className="text-sky-300">&quot;projects&quot;</span>: <span className="text-amber-200">[3 items]</span>,</p>
              <p className="pl-4"><span className="text-sky-300">&quot;success&quot;</span>: <span className="text-emerald-300">true</span></p>
              <p><span className="text-violet-300">&#125;</span></p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-slate-500">
          <span>Built for the way you work.</span>
          <span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-3.5 w-3.5" /> Secure sign in</span>
        </div>
      </section>

      <section className="flex min-h-screen flex-col bg-[#090b10] px-5 py-6 sm:px-8 lg:px-12">
        <a href="/sign-in" className="inline-flex w-fit items-center gap-2.5 lg:hidden">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-300/20 bg-indigo-400/10 text-indigo-300">
            <Braces className="h-[18px] w-[18px]" />
          </span>
          <span className="font-semibold tracking-tight">Requestly</span>
        </a>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[390px]">
            <div className="mb-8">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-indigo-300">
                <Command className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-indigo-300">Welcome to Requestly</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">Sign in to your account</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Continue with your {googleEnabled ? "GitHub or Google" : "GitHub"} account to open your workspace.
              </p>
            </div>

            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                disabled={pendingProvider !== null}
                onClick={() => handleSignIn("github")}
                className="h-12 w-full justify-center gap-3 border-white/10 bg-white/[0.04] text-sm font-medium text-white hover:bg-white/[0.08] hover:text-white"
              >
                <FaGithub className="h-[18px] w-[18px]" />
                {pendingProvider === "github" ? "Connecting…" : "Continue with GitHub"}
              </Button>
              {googleEnabled && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pendingProvider !== null}
                  onClick={() => handleSignIn("google")}
                  className="h-12 w-full justify-center gap-3 border-white/10 bg-white/[0.04] text-sm font-medium text-white hover:bg-white/[0.08] hover:text-white"
                >
                  <FcGoogle className="h-[18px] w-[18px]" />
                  {pendingProvider === "google" ? "Connecting…" : "Continue with Google"}
                </Button>
              )}
            </div>

            <div className="my-7 flex items-center gap-4">
              <div className="h-px flex-1 bg-white/[0.08]" />
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-600">Secure access</span>
              <div className="h-px flex-1 bg-white/[0.08]" />
            </div>

            <p className="text-center text-xs leading-5 text-slate-500">
              By continuing, you agree to use Requestly responsibly. Your provider
              handles authentication securely.
            </p>

            <div className="mt-10 flex items-center justify-center gap-2 text-xs text-slate-600">
              <LockKeyhole className="h-3.5 w-3.5" />
              Your account stays protected by your identity provider
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-center gap-2 pb-1 text-[11px] text-slate-600">
          <span>Requestly</span><span>·</span><span>API work, made clearer</span>
        </footer>
      </section>
    </main>
  );
}
