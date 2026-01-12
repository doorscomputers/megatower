import { NextResponse } from "next/server"

// This endpoint has been deprecated - SP Assessment is now applied globally via bill generation
export async function PATCH() {
  return NextResponse.json(
    { error: "This endpoint has been deprecated. SP Assessment is now applied globally via billing adjustments." },
    { status: 410 }
  )
}
