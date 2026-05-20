import { NextResponse } from 'next/server'

export const revalidate = 60

export async function GET() {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,jito-governance-token,chainlink,avalanche-2&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true',
      { headers: { 'Accept': 'application/json' }, next: { revalidate: 60 } }
    )
    if (!res.ok) return NextResponse.json({ error: `CoinGecko ${res.status}` }, { status: res.status })
    const data = await res.json()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' }
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Fetch failed' }, { status: 500 })
  }
}
