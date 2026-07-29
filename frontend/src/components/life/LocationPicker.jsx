import { useEffect, useRef, useState } from 'react'

import { getLocationSuggestions, getNearbyLocations } from '../../api/locations.js'
import { loadBaiduMap } from '../../lib/baiduMap.js'


function LocationMap({ center, onCenterChange }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const dragHandlerRef = useRef(null)
  const onCenterChangeRef = useRef(onCenterChange)
  const [loadError, setLoadError] = useState('')
  const centerLatitude = center?.latitude
  const centerLongitude = center?.longitude

  useEffect(() => {
    onCenterChangeRef.current = onCenterChange
  }, [onCenterChange])

  useEffect(() => {
    if (centerLatitude == null || centerLongitude == null || !containerRef.current) return undefined
    let cancelled = false

    loadBaiduMap()
      .then((BMap) => {
        if (cancelled || !containerRef.current) return
        const point = new BMap.Point(centerLongitude, centerLatitude)
        if (mapRef.current) {
          mapRef.current.setCenter(point)
          return
        }
        const map = new BMap.Map(containerRef.current)
        map.centerAndZoom(point, 17)
        map.enableScrollWheelZoom()
        const handleDragEnd = () => {
          const next = map.getCenter()
          onCenterChangeRef.current({
            latitude: next.lat,
            longitude: next.lng,
            coord_type: 'bd09ll',
          })
        }
        map.addEventListener('dragend', handleDragEnd)
        mapRef.current = map
        dragHandlerRef.current = handleDragEnd
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.message)
      })

    return () => {
      cancelled = true
    }
  }, [centerLatitude, centerLongitude])

  useEffect(() => () => {
    if (mapRef.current && dragHandlerRef.current) {
      mapRef.current.removeEventListener('dragend', dragHandlerRef.current)
    }
    mapRef.current = null
    dragHandlerRef.current = null
  }, [])

  if (!center) {
    return (
      <div className="location-map location-map--empty">
        定位当前位置或选择搜索结果后，这里会显示地图。
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="location-map-fallback" role="status">
        <span className="location-map-fallback__icon" aria-hidden="true">⌖</span>
        <span>
          <strong>地图暂时无法显示</strong>
          <small>{loadError} 附近地点和手动填写仍可使用。</small>
        </span>
      </div>
    )
  }

  return (
    <>
      <div className="location-map-shell">
        <div className="location-map" ref={containerRef} aria-label="百度地点选择地图" />
        <span className="location-map__pin" aria-hidden="true">●</span>
      </div>
      <small className="location-map__hint">
        拖动地图后，会按地图中心重新查找附近地点。
      </small>
    </>
  )
}

function PlaceList({ title, places, selected, onSelect, empty }) {
  return (
    <section className="location-results" aria-label={title}>
      <div className="location-results__heading">
        <h3>{title}</h3>
        <small>{places.length ? `${places.length} 个结果` : ''}</small>
      </div>
      {places.length ? (
        <div className="location-results__list">
          {places.map((place) => {
            const isSelected = Boolean(
              selected
              && (
                (place.provider_id && selected.provider_id === place.provider_id)
                || (
                  !place.provider_id
                  && selected.latitude === place.latitude
                  && selected.longitude === place.longitude
                )
              ),
            )
            return (
              <button
                type="button"
                className={`location-place${isSelected ? ' is-selected' : ''}`}
                aria-pressed={isSelected}
                key={place.provider_id || `${place.name}-${place.latitude}-${place.longitude}`}
                onClick={() => onSelect(place)}
              >
                <span className="location-place__marker" aria-hidden="true">
                  {isSelected ? '●' : '○'}
                </span>
                <span className="location-place__content">
                  <strong>{place.name}</strong>
                  {place.address && <small>{place.address}</small>}
                </span>
                {Number.isFinite(place.distance_meters) && place.distance_meters > 0
                  ? <em className="location-place__distance">{place.distance_meters} m</em>
                  : null}
              </button>
            )
          })}
        </div>
      ) : <p className="location-results__empty">{empty}</p>}
    </section>
  )
}

function geolocationMessage(error) {
  if (error?.code === 1) return '你拒绝了定位权限，可以搜索或手动填写地点。'
  if (error?.code === 2) return '浏览器暂时无法确定位置，可以搜索或手动填写地点。'
  if (error?.code === 3) return '定位请求超时，请重试或手动填写地点。'
  return '当前浏览器无法定位，可以搜索或手动填写地点。'
}

export default function LocationPicker({ value, onConfirm, onClose }) {
  const [manualValue, setManualValue] = useState(value || '')
  const [selected, setSelected] = useState(null)
  const [center, setCenter] = useState(null)
  const [nearby, setNearby] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [region, setRegion] = useState('')
  const [query, setQuery] = useState('')
  const [address, setAddress] = useState('')
  const [status, setStatus] = useState('')
  const [loadingNearby, setLoadingNearby] = useState(false)
  const [locating, setLocating] = useState(false)
  const [searching, setSearching] = useState(false)
  const nearbySequence = useRef(0)
  const centerRef = useRef(center)

  useEffect(() => {
    centerRef.current = center
  }, [center])

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  async function loadNearby(nextCenter, coordType) {
    const sequence = nearbySequence.current + 1
    nearbySequence.current = sequence
    setLoadingNearby(true)
    setStatus('')
    try {
      const data = await getNearbyLocations({
        latitude: nextCenter.latitude,
        longitude: nextCenter.longitude,
        coord_type: coordType,
        radius: 500,
      })
      if (nearbySequence.current !== sequence) return
      setCenter(data.center)
      setNearby(data.places)
      setAddress(data.address)
      setRegion((current) => current || data.city)
    } catch (error) {
      if (nearbySequence.current === sequence) setStatus(error.message)
    } finally {
      if (nearbySequence.current === sequence) setLoadingNearby(false)
    }
  }

  function locate() {
    setSelected(null)
    setLocating(true)
    setStatus('')
    if (!navigator.geolocation) {
      setLocating(false)
      setStatus('当前浏览器不支持定位，可以搜索或手动填写地点。')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        loadNearby(
          {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          'wgs84ll',
        )
      },
      (error) => {
        setLocating(false)
        setStatus(geolocationMessage(error))
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
      },
    )
  }

  useEffect(() => {
    const normalized = query.trim()
    const cjk = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/u.test(normalized)
    const enough = normalized.length >= (cjk ? 2 : 3)
    if (!enough || !region.trim()) return undefined

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setSearching(true)
      setStatus('')
      try {
        const searchCenter = centerRef.current
        const data = await getLocationSuggestions(
          {
            query: normalized,
            region: region.trim(),
            ...(searchCenter
              ? {
                  latitude: searchCenter.latitude,
                  longitude: searchCenter.longitude,
                  coord_type: 'bd09ll',
                }
              : {}),
          },
          controller.signal,
        )
        setSearchResults(data.places)
      } catch (error) {
        if (error.code !== 'REQUEST_CANCELLED') setStatus(error.message)
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, 450)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [query, region])

  function choose(place) {
    setSelected(place)
    setManualValue(place.name)
    setCenter({
      latitude: place.latitude,
      longitude: place.longitude,
      coord_type: 'bd09ll',
    })
  }

  function mapMoved(nextCenter) {
    setSelected(null)
    setCenter(nextCenter)
    loadNearby(nextCenter, 'bd09ll')
  }

  function confirm() {
    onConfirm(manualValue.trim())
    onClose()
  }

  return (
    <div className="location-picker__backdrop" role="presentation">
      <section
        className="location-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-picker-title"
      >
        <header>
          <div>
            <p className="eyebrow">Location</p>
            <h2 id="location-picker-title">添加地点</h2>
            <small>地点是可选项，只有点击定位按钮后才会请求你的位置。</small>
          </div>
          <button type="button" aria-label="关闭地点选择器" onClick={onClose}>×</button>
        </header>

        <div className="location-picker__body">
          <div className="location-search">
            <label>
              城市
              <input
                value={region}
                maxLength="50"
                placeholder="例如：北京市"
                onChange={(event) => {
                  setRegion(event.target.value)
                  setSearchResults([])
                  setSearching(false)
                }}
              />
            </label>
            <label>
              搜索地点
              <input
                value={query}
                maxLength="45"
                placeholder="至少输入 2 个中文或 3 个其他字符"
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSearchResults([])
                  setSearching(false)
                }}
              />
            </label>
          </div>

          <button
            type="button"
            className="location-locate"
            disabled={locating || loadingNearby}
            onClick={locate}
          >
            ◎ {locating ? '正在定位…' : '定位当前位置'}
          </button>
          <p className="location-privacy-note">
            定位和地点搜索会由百度地图处理。
            <a
              href="https://lbsyun.baidu.com/docs/pcsa?title=compliance/openprivacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              查看百度地图开放平台隐私政策
            </a>
          </p>

          {status && <p className="location-picker__status" role="status">{status}</p>}
          <LocationMap center={center} onCenterChange={mapMoved} />

          {searching
            ? <p className="location-results__empty">正在搜索地点…</p>
            : searchResults.length > 0 && (
              <PlaceList
                title="搜索结果"
                places={searchResults}
                selected={selected}
                onSelect={choose}
                empty="没有找到相符地点。"
              />
            )}

          <PlaceList
            title="当前位置附近"
            places={nearby}
            selected={selected}
            onSelect={choose}
            empty={loadingNearby ? '正在查找附近地点…' : '定位或拖动地图后显示附近地点。'}
          />

          {address && !selected && (
            <button
              type="button"
              className="location-use-address"
              onClick={() => setManualValue(address)}
            >
              使用地图中心地址：{address}
            </button>
          )}

          <label className="location-manual">
            手动填写地点
            <input
              value={manualValue}
              maxLength="100"
              placeholder="例如：回家的路上"
              onChange={(event) => {
                setSelected(null)
                setManualValue(event.target.value)
              }}
            />
            <small>可以自由填写，也可以留空，不会保存百度 POI UID 或坐标。</small>
          </label>
        </div>

        <footer>
          <button
            type="button"
            onClick={() => {
              onConfirm('')
              onClose()
            }}
          >
            清除地点
          </button>
          <span />
          <button type="button" onClick={onClose}>取消</button>
          <button type="button" className="button button--primary" onClick={confirm}>确定</button>
        </footer>
      </section>
    </div>
  )
}
