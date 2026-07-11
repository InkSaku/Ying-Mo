const HTTP_ERROR_MESSAGES = {
  404: ['HTTP_NOT_FOUND', '后端健康检查接口不存在，请检查服务版本。'],
  500: ['SERVER_ERROR', '后端服务暂时异常，请稍后重试。'],
}

export function createApiError({ code, message, status = null }) {
  const apiError = new Error(message)
  apiError.name = 'YingmoApiError'
  apiError.isYingmoApiError = true
  apiError.status = status
  apiError.code = code
  return apiError
}

export function toApiError(error) {
  if (error?.isYingmoApiError) {
    return error
  }

  if (error?.code === 'ERR_CANCELED') {
    return createApiError({ code: 'REQUEST_CANCELLED', message: '请求已取消。' })
  }

  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
    return createApiError({ code: 'REQUEST_TIMEOUT', message: '请求超时，请检查后端服务后重试。' })
  }

  const status = error?.response?.status ?? null
  const responseError = error?.response?.data?.error
  if (responseError?.code && responseError?.message) {
    return createApiError({
      code: responseError.code,
      message: responseError.message,
      status,
    })
  }

  if (status && HTTP_ERROR_MESSAGES[status]) {
    const [code, message] = HTTP_ERROR_MESSAGES[status]
    return createApiError({ code, message, status })
  }

  if (status && status >= 500) {
    return createApiError({
      code: 'SERVER_ERROR',
      message: '后端服务暂时异常，请稍后重试。',
      status,
    })
  }

  return createApiError({
    code: 'NETWORK_UNAVAILABLE',
    message: '暂时无法连接后端服务，请检查服务是否已启动。',
  })
}
