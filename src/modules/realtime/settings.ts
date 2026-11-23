import { z } from "zod";

const pair = z.object({
  key: z.string().min(1).max(128),
  value: z.string().max(4096),
  enabled: z.boolean().default(true),
});
export const settingsSchema = z.object({
  url: z.string().min(1).max(4096),
  parameters: z.array(pair).max(64),
  headers: z.array(pair).max(64),
  protocols: z.array(z.string().regex(/^[\w.+-]+$/)).max(8),
  reconnect: z.boolean(),
  format: z.enum(["text", "json", "binary"]),
  draft: z.string().max(90000),
});
export type Settings = z.infer<typeof settingsSchema>;
export const defaults: Settings = {
  url: "",
  parameters: [],
  headers: [],
  protocols: [],
  reconnect: false,
  format: "text",
  draft: "",
};
