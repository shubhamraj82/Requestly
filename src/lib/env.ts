import {createEnv} from "@t3-oss/env-nextjs";
import {z} from "zod";

export const env = createEnv({
    server:{
        GITHUB_CLIENT_ID:z.string().min(1),
        GITHUB_CLIENT_SECRET:z.string().min(1),
        GOOGLE_CLIENT_ID:z.string().trim().optional(),
        GOOGLE_CLIENT_SECRET:z.string().trim().optional(),
    },
    experimental__runtimeEnv:process.env,
})

export const googleProvider = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
    : undefined;
