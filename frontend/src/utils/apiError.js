export function createApiError({
  code,
  message,
  status = null,
  details = [],
  requestId = null,
}) {
  const apiError = new Error(message)

  apiError.name = 'YingmoApiError'
  apiError.isYingmoApiError = true
  apiError.status = status
  apiError.code = code
  apiError.details = details
  apiError.requestId = requestId

  return apiError
}

export function toApiError(error) {
  if (error?.isYingmoApiError) {
    return error
  }

  if (error?.code === 'ERR_CANCELED') {
    return createApiError({
      code: 'REQUEST_CANCELLED',
      message: '请求已取消。',
    })
  }

  if (
    error?.code === 'ECONNABORTED'
    || error?.code === 'ETIMEDOUT'
  ) {
    return createApiError({
      code: 'REQUEST_TIMEOUT',
      message: '请求超时，请稍后重试。',
    })
  }

  const status = error?.response?.status ?? null
  const responseError = error?.response?.data?.error

  // 后端返回了项目统一错误格式
  if (responseError?.code && responseError?.message) {
    return createApiError({
      code: responseError.code,
      message: responseError.message,
      status,
      details: responseError.details ?? [],
      requestId: responseError.request_id ?? null,
    })
  }

  // 已经收到服务器响应，就不能称为“后端未启动”
  if (status === 401) {
    return createApiError({
      code: 'AUTHENTICATION_REQUIRED',
      message: '当前未登录或登录状态已失效。',
      status,
    })
  }

  if (status === 403) {
    return createApiError({
      code: 'FORBIDDEN',
      message: '当前账号没有权限执行此操作。',
      status,
    })
  }

  if (status === 404) {
    return createApiError({
      code: 'RESOURCE_NOT_FOUND',
      message: '请求的资源不存在。',
      status,
    })
  }

  if (status === 409) {
    return createApiError({
      code: 'DUPLICATE_RESOURCE',
      message: '提交的数据与现有记录冲突。',
      status,
    })
  }

  if (status === 422) {
    return createApiError({
      code: 'VALIDATION_ERROR',
      message: '请求参数不合法。',
      status,
    })
  }

  if (status && status >= 500) {
    return createApiError({
      code: 'SERVER_ERROR',
      message: '后端服务暂时异常，请稍后重试。',
      status,
    })
  }

  if (status) {
    return createApiError({
      code: 'REQUEST_FAILED',
      message: '请求未能完成，请检查后重试。',
      status,
    })
  }

  // error.response 不存在，才是真正连接不到后端
  return createApiError({
    code: 'NETWORK_UNAVAILABLE',
    message: '暂时无法连接后端服务，请检查服务是否已启动。',
  })
}
