"use server"

import db from "@/lib/db";
import { currentUser } from "@/modules/authentication/actions";

export const createCollection = async (workspaceId:string, name:string)=>{
    const collection = await db.collection.create({
        data:{
            name,
            workspace:{
                connect:{
                    id:workspaceId
                }
            }
        }
    })
    return collection;
}

export const getCollection=async(workspaceId:string)=>{
    const collection = await db.collection.findMany({
        where:{
            workspaceId
        }
    })
    return collection;
}

export const  deleteCollection=async(collectionId:string)=>{
    const user = await currentUser();
    if (!user) throw new Error("Sign in to delete a collection");
    await db.collection.delete({
        where:{
            id:collectionId,
            workspace: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] }
        }
    })
}

export const updateCollection=async(collectionId:string,name:string)=>{
    await db.collection.update({
        where:{
            id:collectionId
        },
        data:{
            name
        }
    })
}