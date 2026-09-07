import getUmPrice from './getUmPrice'

describe('getUmPrice', () => {
    test('returns transformed data', async () => {
        // The implementation reads the /api/um-price proxy, which already
        // returns {change, price} and sets `ok`. The old mock still described
        // the raw CoinGecko array and omitted `ok`, so the request looked
        // failed and the assertion below got `undefined`.
        global.fetch = jest.fn().mockImplementation(() =>
            Promise.resolve({
                ok: true,
                json: () => ({
                    change: -9.99,
                    price: 9999,
                }),
            })
        )

        await expect(getUmPrice()).resolves.toEqual({
            change: -9.99,
            price: 9999,
        })
    })

    test('returns nothing when invalid data', async () => {
        global.fetch = jest.fn().mockImplementation(() =>
            Promise.resolve({
                json: () => ({ foo: 'bar' }),
            })
        )

        await expect(getUmPrice()).resolves.toBeUndefined()
    })

    test('logs error', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation()

        global.fetch = jest.fn().mockImplementation(() => Promise.reject('foo'))

        await getUmPrice()
        expect(consoleError).toHaveBeenCalledWith('foo')
    })
})
