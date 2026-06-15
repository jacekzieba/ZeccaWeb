import { NextResponse, type NextRequest } from "next/server";
import { rateLimitResponse } from "@/market-data/rate-limit";

export async function GET(request: NextRequest) {
  const limited = rateLimitResponse(request);
  if (limited) return limited;

  const stooqConfigured = Boolean(process.env.STOOQ_API_KEY?.trim());

  return NextResponse.json({
    providers: {
      yahoo: {
        configured: true,
      },
      stooq: {
        configured: stooqConfigured,
        requiredEnv: "STOOQ_API_KEY",
      },
      nbp: {
        configured: true,
      },
    },
  });
}
