import { currentUser } from "@/modules/authentication/actions";
import Header from "@/modules/layout/components/headers";
import { initializeWorkspace } from "@/modules/workspace/actions";
import React from "react";

export const dynamic = "force-dynamic";

const RootLayout= async({children}:{children:React.ReactNode})=>{

    const user=await currentUser();
    if (user) {
        await initializeWorkspace();
    }
    return (
        <>
        {/* @ts-ignore */}
        <Header user={user}/>
         <main className='max-h-[calc(100vh-4rem)] h-[calc(100vh-4rem)] flex flex-1 overflow-hidden'>
            <div className="flex h-full w-full">
                <div className="w-12 border-zinc-800 bg-zinc-900">
                    tabbedleft pannel
                </div>
                <div className="flex-1 bg-zinc-900">
                    {children}
                </div>
            </div>
        </main>
        </>
    )
}
export default RootLayout;
