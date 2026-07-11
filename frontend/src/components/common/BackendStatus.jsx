function getErrorContent(error) {
  switch (error.code) {
    case 'DATABASE_UNAVAILABLE':
      return {
        title: '后端服务可访问，但数据库连接异常',
        message: '请检查数据库配置或初始化状态，然后重新检查。',
      }
    case 'RESPONSE_INVALID':
      return {
        title: '服务返回了无法识别的数据',
        message: '请确认前后端版本匹配，然后重新检查。',
      }
    case 'HTTP_NOT_FOUND':
    case 'RESOURCE_NOT_FOUND':
      return {
        title: '未找到后端健康检查接口',
        message: '请确认 Flask 服务已更新并提供 /api/v1/health。',
      }
    case 'REQUEST_TIMEOUT':
      return {
        title: '连接后端服务超时',
        message: '请检查后端服务和数据库是否正常运行。',
      }
    case 'SERVER_ERROR':
    case 'INTERNAL_ERROR':
      return {
        title: '后端服务暂时异常',
        message: '请检查后端日志后重新检查。',
      }
    default:
      return {
        title: '暂时无法连接后端服务',
        message: '请检查 Flask 服务是否已启动，以及 API 地址和 CORS 配置是否正确。',
      }
  }
}

export default function BackendStatus({ status, health, error, onRetry }) {
  if (status === 'loading') {
    return (
      <section className="backend-status" aria-live="polite">
        <p>正在检查服务连接……</p>
      </section>
    )
  }

  if (status === 'success') {
    return (
      <section className="backend-status backend-status--success" aria-live="polite">
        <p className="backend-status__label">检查成功</p>
        <h2>后端服务已连接</h2>
        <dl className="backend-status__details">
          <div><dt>服务名称</dt><dd>{health.service}</dd></div>
          <div><dt>当前环境</dt><dd>{health.environment}</dd></div>
          <div><dt>数据库</dt><dd>已连接</dd></div>
        </dl>
        <button type="button" onClick={onRetry}>重新检查</button>
      </section>
    )
  }

  const content = getErrorContent(error)
  return (
    <section className="backend-status backend-status--error" role="alert" aria-live="assertive">
      <h2>{content.title}</h2>
      <p>{content.message}</p>
      <button type="button" onClick={onRetry}>重新检查</button>
    </section>
  )
}
