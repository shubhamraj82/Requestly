import { currentUser } from "@/modules/authentication/actions";
import Header from "@/modules/layout/components/headers";
import { initializeWorkspace } from "@/modules/workspace/actions";
import React from "react";
import { redirect } from "next/navigation";
import TabbedLeftPanel from "@/modules/workspace/components/tabbed-left-panel";

export const dynamic = "force-dynamic";

const RootLayout= async({children}:{children:React.ReactNode})=>{

    const user=await currentUser();
    if (!user) redirect("/sign-in");
    await initializeWorkspace();
    return (
        <div className="grid h-dvh grid-rows-[auto_minmax(0,1fr)]">
        {/* @ts-ignore */}
        <Header user={user}/>
         <main className="min-h-0 overflow-hidden">
            <div className="flex h-full w-full">
                <div className="w-12 border-zinc-800 bg-zinc-900">
                    <TabbedLeftPanel/>
                </div>
                <div className="min-h-0 min-w-0 flex-1 bg-zinc-900">
                    {children}
                </div>
            </div>
        </main>
        </div>
    )
}
export default RootLayout;
