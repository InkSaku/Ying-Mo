import { Link } from 'react-router-dom'

export default function AboutPage() {
  return <section className="page-container not-found-page"><p className="eyebrow">关于映墨</p><h1>记录生活，分享经验</h1><p>映墨是一个围绕日常记录与游戏教材交流的社区。你可以浏览公开内容，或登录后留下自己的故事与实践经验。</p><Link className="button button--primary" to="/">返回首页</Link></section>
}
