import { NextResponse } from "next/server";

import { GenerateStoryInputSchema } from "@/lib/types";
import { generateStory } from "@/ai/flows/generate-story";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = GenerateStoryInputSchema.parse(json);
    const story = await generateStory(input, { signal: request.signal });
    return NextResponse.json({ success: true, data: story });
  } catch (error: any) {
    if (request.signal.aborted || error?.name === "AbortError") {
      return NextResponse.json({ success: false, error: "aborted" }, { status: 499 });
    }

    const message =
      typeof error?.message === "string" && error.message
        ? error.message
        : "生成故事时发生错误。";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

