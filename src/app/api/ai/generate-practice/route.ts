import { NextResponse } from "next/server";

import { GeneratePracticeInputSchema } from "@/lib/types";
import { generatePractice } from "@/ai/flows/generate-practice";

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = GeneratePracticeInputSchema.parse(json);
    const questions = await generatePractice(input, { signal: request.signal });
    return NextResponse.json({ success: true, data: { questions } });
  } catch (error: any) {
    if (request.signal.aborted || error?.name === "AbortError") {
      return NextResponse.json({ success: false, error: "aborted" }, { status: 499 });
    }

    const message =
      typeof error?.message === "string" && error.message
        ? error.message
        : "生成练习题时发生错误。";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

