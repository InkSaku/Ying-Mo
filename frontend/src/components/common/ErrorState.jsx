export default function ErrorState({ title = '暂时无法完成操作。', message, onRetry }) {
  return (
    <section className="state-message state-message--error" role="alert">
      <h2>{title}</h2>
      {message ? <p>{message}</p> : null}
      {onRetry ? <button type="button" onClick={onRetry}>重试</button> : null}
    </section>
  )
}
