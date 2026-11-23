"use client"

import {Button} from "@/components/ui/button"
import { Hint } from "@/components/ui/hint"
import {UserPlus} from "lucide-react"
import React from "react"

const InviteMember=()=>{
    return (
        <Hint label="Invite Members">
        <Button variant="ghost" aria-label="Invite members" className="h-8 rounded-md px-2 text-zinc-300 hover:bg-zinc-800 hover:text-white">
            <UserPlus className="size-4" />
            <span className="hidden sm:inline">Invite</span>
        </Button>
        </Hint>
    )
}

export default InviteMember