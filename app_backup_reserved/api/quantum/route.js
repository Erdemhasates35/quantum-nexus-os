import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({
      timestamp: Date.now(),
      status: "SUCCESS",
      node: "Quantum-Node-İzmir",
      payload: { signal_status: "STANDBY", execution_velocity: "0.12ms" }
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Internal Matrix Error" }, { status: 500 });
  }
}
