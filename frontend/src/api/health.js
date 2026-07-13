import { apiClient } from './client'
import { createApiError } from '../utils/apiError'

function isHealthPayload(data) {
  return data
    && data.status === 'ok'
    && typeof data.service === 'string'
    && typeof data.environment === 'string'
    && data.database === 'connected'
}

export async function getHealthStatus(config = {}) {
  const response = await apiClient.get('/health/ready', {
    ...config,
    params: {
      ...config.params,
      check: Date.now(),
    },
  })
  const health = response.data?.data

  if (!isHealthPayload(health)) {
    if (import.meta.env.DEV) {
      console.error('Received an invalid Yingmo health response.')
    }
    throw createApiError({
      code: 'RESPONSE_INVALID',
      message: '服务返回了无法识别的数据，请稍后重新检查。',
      status: response.status,
    })
  }

  return health
}
