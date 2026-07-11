export default function LoadingState({ label = '正在加载…' }) {
  return <p className="state-message" role="status">{label}</p>
}
