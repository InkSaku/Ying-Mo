import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getLocationSuggestions, getNearbyLocations } from '../../api/locations.js'
import LocationPicker from './LocationPicker.jsx'


vi.mock('../../api/locations.js', () => ({
  getLocationSuggestions: vi.fn(),
  getNearbyLocations: vi.fn(),
}))

vi.mock('../../lib/baiduMap.js', () => ({
  loadBaiduMap: vi.fn().mockRejectedValue(new Error('测试环境未加载地图')),
}))

beforeEach(() => {
  vi.clearAllMocks()
  getNearbyLocations.mockResolvedValue({
    center: { latitude: 39.9523, longitude: 116.3467, coord_type: 'bd09ll' },
    address: '北京市海淀区上园村3号',
    city: '北京市',
    places: [{
      provider_id: 'poi-1',
      name: '北京交通大学图书馆',
      address: '上园村3号',
      latitude: 39.9523,
      longitude: 116.3467,
      distance_meters: 28,
    }],
  })
  getLocationSuggestions.mockResolvedValue({
    places: [{
      provider_id: 'poi-2',
      name: '北京交通大学东门',
      address: '北京市海淀区交通大学路',
      latitude: 39.951,
      longitude: 116.349,
    }],
  })
})

describe('location picker', () => {
  it('allows a manual optional value without requesting location', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<LocationPicker value="" onConfirm={onConfirm} onClose={vi.fn()} />)

    await user.type(screen.getByPlaceholderText('例如：回家的路上'), '回家的路上')
    await user.click(screen.getByRole('button', { name: '确定' }))

    expect(onConfirm).toHaveBeenCalledWith('回家的路上')
    expect(getNearbyLocations).not.toHaveBeenCalled()
  })

  it('requests browser location only after the locate button and selects a nearby POI', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const getCurrentPosition = vi.fn((success) => success({
      coords: { latitude: 39.95, longitude: 116.34 },
    }))
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    })
    render(<LocationPicker value="" onConfirm={onConfirm} onClose={vi.fn()} />)

    expect(getCurrentPosition).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /定位当前位置/ }))
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(getNearbyLocations).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 39.95,
        longitude: 116.34,
        coord_type: 'wgs84ll',
      }),
    )

    await user.click(await screen.findByRole('button', { name: /北京交通大学图书馆/ }))
    expect(await screen.findByText('地图暂时无法显示')).toBeInTheDocument()
    expect(screen.queryByText('拖动地图后，会按地图中心重新查找附近地点。')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '确定' }))
    expect(onConfirm).toHaveBeenCalledWith('北京交通大学图书馆')
  })

  it('searches by city after debounce and can select a result', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<LocationPicker value="" onConfirm={onConfirm} onClose={vi.fn()} />)

    await user.type(screen.getByPlaceholderText('例如：北京市'), '北京市')
    await user.type(
      screen.getByPlaceholderText('至少输入 2 个中文或 3 个其他字符'),
      '北京交通',
    )

    await waitFor(() => expect(getLocationSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({
        query: '北京交通',
        region: '北京市',
      }),
      expect.any(AbortSignal),
    ))
    await user.click(await screen.findByRole('button', { name: /北京交通大学东门/ }))
    await user.click(screen.getByRole('button', { name: '确定' }))
    expect(onConfirm).toHaveBeenCalledWith('北京交通大学东门')
  })

  it('falls back cleanly when location permission is denied', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_success, failure) => failure({ code: 1 }),
      },
    })
    render(<LocationPicker value="" onConfirm={vi.fn()} onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /定位当前位置/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('拒绝了定位权限')
    expect(screen.getByPlaceholderText('例如：回家的路上')).toBeEnabled()
  })
})
