"use server"

import { auth } from "@/lib/auth"
import db from "@/lib/db";
import { headers } from "next/headers"

export const currentUser = async ()=>{
    // Keep request-time data access outside the catch block. Next uses the
    // dynamic-render signal from headers() during prerendering, and swallowing
    // it here makes a valid request-time route look like an unauthenticated user.
    const requestHeaders = await headers();

    try{
        const session = await auth.api.getSession({
            headers:requestHeaders
        });

        if(!session){
            return null;
        }

        const user= await db.user.findUnique({
            where:{
                id:session.user.id
            },
            select:{
                id:true,
                email:true,
                name:true,
                image:true,
                createdAt:true,
                updatedAt:true,
            }
        });
        return user;
    } catch(error) {
        console.error("Error fetching cureent user details",error)
        return null;
    }
}
