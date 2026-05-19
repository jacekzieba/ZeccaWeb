import { NextResponse } from "next/server";

export async function GET() {
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
