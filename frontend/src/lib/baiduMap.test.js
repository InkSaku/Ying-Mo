import { afterEach, describe, expect, it, vi } from 'vitest'


afterEach(() => {
  document.querySelectorAll('script[data-yingmo-baidu-map]').forEach((script) => script.remove())
  delete window.BMap
  delete window.BMapGL
  delete window.__yingmoBaiduMapReady
  vi.resetModules()
})

describe('baidu map loader', () => {
  it('waits for the JS API 4.0 callback and resolves BMapGL', async () => {
    const { loadBaiduMap } = await import('./baiduMap.js')
    const loading = loadBaiduMap()
    const script = document.querySelector('script[data-yingmo-baidu-map]')

    expect(script).not.toBeNull()
    expect(new URL(script.src).searchParams.get('v')).toBe('4.0')
    expect(new URL(script.src).searchParams.get('callback')).toBe('__yingmoBaiduMapReady')

    window.BMapGL = { Map: vi.fn(), Point: vi.fn() }
    window.__yingmoBaiduMapReady()

    await expect(loading).resolves.toBe(window.BMapGL)
  })

  it('reuses an already loaded BMapGL API without adding another script', async () => {
    window.BMapGL = { Map: vi.fn(), Point: vi.fn() }
    const { loadBaiduMap } = await import('./baiduMap.js')

    await expect(loadBaiduMap()).resolves.toBe(window.BMapGL)
    expect(document.querySelector('script[data-yingmo-baidu-map]')).toBeNull()
  })
})
