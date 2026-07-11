import axios from 'axios'
import { toApiError } from '../utils/apiError.js'

const DEFAULT_API_BASE_URL = '/api/v1'

export const apiClient = axios.create({
  baseURL: import.meta.env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,
  timeout: 10_000,
  headers: {
    Accept: 'application/json',
  },
})

apiClient.interceptors.request.use(
  (config) => {
    // 后续认证任务在这里统一附加 access token，组件不得自行拼接后端地址。
    return config
  },
  (error) => Promise.reject(toApiError(error)),
)

apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(toApiError(error)),
)
