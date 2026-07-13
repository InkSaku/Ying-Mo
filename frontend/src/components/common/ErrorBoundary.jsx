import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) {
      console.error('Yingmo frontend error boundary:', error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false })
  }

  goHome = () => {
    window.location.assign('/')
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="error-boundary" role="alert">
          <h1>页面暂时无法显示</h1>
          <p>请重新尝试；若问题仍然存在，可以返回首页继续浏览。</p>
          <div className="admin-actions"><button type="button" onClick={this.handleReset}>重新尝试</button><button type="button" className="button--primary" onClick={this.goHome}>返回首页</button></div>
        </main>
      )
    }

    return this.props.children
  }
}
