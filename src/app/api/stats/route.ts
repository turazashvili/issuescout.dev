import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { IndexedRepo } from "@/models/IndexedRepo";

export async function GET() {
  try {
    await connectToDatabase();

    const repoCount = await IndexedRepo.countDocuments();

    return NextResponse.json({
      reposIndexed: repoCount,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json({
      reposIndexed: 0,
    });
  }
}
