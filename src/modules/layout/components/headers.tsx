"use client";

import Link from "next/link";
import { Unplug } from "lucide-react";
import UserButton from "@/modules/authentication/components/user-button";
import type { UserProps } from "../types";
import SearchBar from "./search-bar";
import InviteMember from "./invite-members";
import WorkSpace from "./workspace";

export default function Header({ user }: { user: UserProps }) {
  return (
    <header className="flex h-14 min-w-0 items-center gap-2 border-b border-zinc-800 bg-[#141619] px-3 text-zinc-100 sm:gap-4 sm:px-5">
      <Link href="/" aria-label="Requestly home" className="flex shrink-0 items-center gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-emerald-300">
        <Unplug size={22} className="text-[#afe6bc]" aria-hidden="true" />
        <span className="hidden text-base font-semibold tracking-tight sm:inline">Requestly</span>
      </Link>
      <span aria-hidden="true" className="hidden text-xl font-light text-zinc-600 sm:inline">/</span>
      <div className="min-w-0">
        <WorkSpace />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
        <SearchBar />
        <InviteMember />
        <div className="border-l border-zinc-700 pl-2 sm:pl-3">
          <UserButton user={user} size="sm" />
        </div>
      </div>
    </header>
  );
}
