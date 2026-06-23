import { NextResponse, type NextRequest } from "next/server";
import { rateLimitResponse } from "@/market-data/rate-limit";

export async function GET(request: NextRequest) {
  const limited = rateLimitResponse(request);
  if (limited) return limited;

  return NextResponse.json({
    providers: {
      yahoo: {
        configured: true,
      },
      nbp: {
        configured: true,
      },
    },
  });
}
