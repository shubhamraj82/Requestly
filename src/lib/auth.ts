import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import db from "./db";
import {env, googleProvider} from "./env"


export const auth = betterAuth({
    database: prismaAdapter(db, {
        provider: "postgresql", // or "mysql", "sqlite", ...etc
    }),

    socialProviders:{
        github:{
            clientId:env.GITHUB_CLIENT_ID,
            clientSecret:env.GITHUB_CLIENT_SECRET,
        },
        ...(googleProvider && { google: googleProvider }),
    }
});