import { z } from "zod";
import { generateJsonBody } from "@/lib/ai-agents";
import { env } from "@/lib/env";
import { currentUser } from "@/modules/authentication/actions";

const input = z.object({
  prompt: z.string().trim().min(1).max(8000),
  method: z.string().max(16).optional(),
  endpoint: z.string().max(4096).optional(),
  context: z.string().max(16000).optional(),
});

export async function POST(request: Request) {
  if (!(await currentUser())) {
    return Response.json({ error: "Sign in to generate a JSON body." }, { status: 401 });
  }
  const params = input.safeParse(await request.json().catch(() => null));
  if (!params.success) {
    return Response.json({ error: "Enter a prompt of 1 to 8,000 characters and valid request details." }, { status: 400 });
  }
  if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json({ error: "The server is missing its Gemini API key." }, { status: 503 });
  }

  const result = await generateJsonBody(params.data);
  if (!result.data) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json(result.data);
}
