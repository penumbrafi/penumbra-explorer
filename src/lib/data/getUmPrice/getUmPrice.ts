import { UmPriceData } from '@/lib/types'

// Use our own /api/um-price proxy instead of hitting CoinGecko directly.
// CoinGecko's free tier doesn't send CORS headers, so a browser fetch
// against api.coingecko.com fails. The route at /api/um-price proxies
// the call server-side and is cached for ~60s.
const url = '/api/um-price'

interface Data {
    change: number
    price: number
}

const getUmPrice = async (): Promise<UmPriceData | undefined> => {
    try {
        const response = await fetch(url)
        if (!response.ok) return
        const data = (await response.json()) as Data
        return {
            change: data.change,
            price: data.price,
        }
    } catch (e) {
        console.error(e)
    }
}

export default getUmPrice
