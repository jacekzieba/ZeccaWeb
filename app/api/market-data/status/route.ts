import { NextResponse } from "next/server";

export async function GET() {
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
