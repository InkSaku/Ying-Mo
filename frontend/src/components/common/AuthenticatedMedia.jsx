import useAuthenticatedImageUrl from '../../hooks/useAuthenticatedImageUrl.js'
import AdaptiveMedia from './AdaptiveMedia.jsx'

export default function AuthenticatedMedia({ src, ...props }) {
  const { url } = useAuthenticatedImageUrl(src)
  return <AdaptiveMedia src={url} {...props} />
}
