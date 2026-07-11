import BackendStatus from '../common/BackendStatus'
import PageContainer from '../layout/PageContainer'

export default function DevelopmentStatus({ status, health, error, onRetry }) {
  return (
    <section className="development-status" aria-labelledby="development-status-title">
      <PageContainer>
        <div className="development-status__inner">
          <div>
            <p className="eyebrow">Development Status</p>
            <h2 id="development-status-title">开发连接状态</h2>
            <p>用于确认 React、Flask 与数据库基础连接，不代表业务接口已经完成。</p>
          </div>
          <BackendStatus status={status} health={health} error={error} onRetry={onRetry} />
        </div>
      </PageContainer>
    </section>
  )
}
