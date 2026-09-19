// Server-side proxy to CoinGecko's market endpoint.
//
// CoinGecko's free public API does not return CORS headers, so a direct
// browser fetch from explorer.rotko.net fails with "blocked by CORS
// policy". Routing the call through our own /api/um-price avoids the
// browser CORS check entirely (the request is now same-origin) while
// keeping CoinGecko upstream unchanged.
//
// Cached at the edge for 60s — CoinGecko rate limits the free tier to
// 30 req/min and we don't need fresher than that for a price ticker.
import { NextResponse } from 'next/server'

export const revalidate = 60

interface CoinGeckoMarket {
    current_price: number
    price_change_percentage_24h: number
}

export async function GET() {
    const upstream =
        'https://api.coingecko.com/api/v3/coins/markets?ids=penumbra&vs_currency=usd'

    try {
        const res = await fetch(upstream, {
            next: { revalidate: 60 },
        })
        if (!res.ok) {
            return NextResponse.json(
                { error: `upstream ${res.status}` },
                { status: 502 }
            )
        }
        const data = (await res.json()) as CoinGeckoMarket[]
        if (!data.length) {
            return NextResponse.json({ error: 'empty' }, { status: 404 })
        }
        return NextResponse.json(
            {
                change: data[0].price_change_percentage_24h,
                price: data[0].current_price,
            },
            {
                headers: {
                    'cache-control':
                        'public, s-maxage=60, stale-while-revalidate=300',
                },
            }
        )
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : String(e) },
            { status: 502 }
        )
    }
}
