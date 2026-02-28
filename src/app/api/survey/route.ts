import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { SurveyVote } from "@/models/SurveyVote";

const QUESTION_ID = "should-opensource";

export async function GET() {
  try {
    await connectToDatabase();

    const [yesCount, noCount] = await Promise.all([
      SurveyVote.countDocuments({ question: QUESTION_ID, vote: "yes" }),
      SurveyVote.countDocuments({ question: QUESTION_ID, vote: "no" }),
    ]);

    return NextResponse.json({ yes: yesCount, no: noCount });
  } catch (error) {
    console.error("Error fetching survey:", error);
    return NextResponse.json({ yes: 0, no: 0 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { vote } = await request.json();

    if (vote !== "yes" && vote !== "no") {
      return NextResponse.json({ error: "Invalid vote" }, { status: 400 });
    }

    await connectToDatabase();

    await SurveyVote.create({ question: QUESTION_ID, vote });

    const [yesCount, noCount] = await Promise.all([
      SurveyVote.countDocuments({ question: QUESTION_ID, vote: "yes" }),
      SurveyVote.countDocuments({ question: QUESTION_ID, vote: "no" }),
    ]);

    return NextResponse.json({ yes: yesCount, no: noCount });
  } catch (error) {
    console.error("Error saving survey vote:", error);
    return NextResponse.json(
      { error: "Failed to save vote" },
      { status: 500 }
    );
  }
}
