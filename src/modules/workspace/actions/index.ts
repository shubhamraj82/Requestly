"use server"

import { authorize } from "../access/server";
import { permissions } from "../access/permissions";
import db from "@/lib/db";
import {currentUser} from "@/modules/authentication/actions";
import {MEMBER_ROLE} from "@prisma/client"

export const initializeWorkspace=async()=>{
    const user = await currentUser();
    if(!user){
        return {
            success: false,
            error:"User not found"
        }
    }
    try{
        const workspace = await db.workspace.upsert({
            where:{
                name_ownerId:{
                    ownerId: user.id,
                    name: "Personal Workspace"
                }
            },
            update:{},
            create:{
                name: "Personal Workspace",
                description:"Default workspace for personal use",
                ownerId: user.id,
                members:{
                    create:{
                        userId: user.id,
                        role: MEMBER_ROLE.ADMIN
                    }
                }
            },
            include:{
                members: true
            }
        })

        return {
            success:true,
            workspace
        }
    }catch(error){
        console.error("Error initializing workspace:", error);
        return {
            success: false,
            error: "Failed to initialize workspace"
        }
    }
}


export async function getWorkspaces() {
    const user = await currentUser();
    if(!user) throw new Error("Unauthorized");

    const workspaces = await db.workspace.findMany({
        where:{
            OR:[
                {ownerId: user.id},
                {members: {some: {userId: user.id, status:"ACTIVE"}}}
            ]
        },
        include:{members:{where:{userId:user.id},select:{permissions:true}}},
        orderBy:{
            createdAt: "asc"
        }
    });
    return workspaces.filter(w => w.ownerId === user.id || permissions("MEMBER", w.members[0]?.permissions).view).map(({id,name,description,ownerId,createdAt,updatedAt}) => ({id,name,description,ownerId,createdAt,updatedAt}));
}

export async function createWorkspaces(name:string){
    const user =await currentUser();
    if(!user) throw new Error("Unauthorized");

    const workspace = await db.workspace.create({
        data:{
            name,
            ownerId:user.id,
            members:{
                create:{
                    userId:user.id,
                    role:MEMBER_ROLE.ADMIN
                }
            }
        }
    })
    return workspace;
}

export const getWorkspaceById=async(id:string)=>{
    const access=await authorize(id,"view");
    const workspace=await db.workspace.findUniqueOrThrow({
        where:{id},

    })
    return {...workspace, access};
}
