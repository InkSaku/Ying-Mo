let baiduMapPromise = null
const CALLBACK_NAME = '__yingmoBaiduMapReady'
const SCRIPT_SELECTOR = 'script[data-yingmo-baidu-map]'


function mapApi() {
  if (window.BMapGL?.Map) return window.BMapGL
  if (window.BMap?.Map) return window.BMap
  return null
}

export function loadBaiduMap() {
  const loadedApi = mapApi()
  if (loadedApi) return Promise.resolve(loadedApi)

  const ak = import.meta.env.VITE_BAIDU_MAP_BROWSER_AK?.trim()
  if (!ak) {
    return Promise.reject(new Error('未配置百度地图浏览器端 AK。'))
  }
  if (baiduMapPromise) return baiduMapPromise

  baiduMapPromise = new Promise((resolve, reject) => {
    let existing = document.querySelector(SCRIPT_SELECTOR)
    if (existing && !existing.src.includes(`callback=${CALLBACK_NAME}`)) {
      existing.remove()
      existing = null
    }
    const script = existing || document.createElement('script')
    let timeoutId

    function cleanup() {
      window.clearTimeout(timeoutId)
      script.removeEventListener('error', failed)
      delete window[CALLBACK_NAME]
    }

    function failed() {
      cleanup()
      script.remove()
      baiduMapPromise = null
      reject(new Error('百度地图加载失败。'))
    }

    window[CALLBACK_NAME] = () => {
      const api = mapApi()
      if (!api) {
        failed()
        return
      }
      cleanup()
      resolve(api)
    }

    script.addEventListener('error', failed, { once: true })
    timeoutId = window.setTimeout(failed, 15_000)
    if (!existing) {
      script.async = true
      script.dataset.yingmoBaiduMap = 'true'
      script.src = `https://api.map.baidu.com/api?v=4.0&ak=${encodeURIComponent(ak)}&callback=${CALLBACK_NAME}`
      document.head.appendChild(script)
    }
  })
  return baiduMapPromise
}
