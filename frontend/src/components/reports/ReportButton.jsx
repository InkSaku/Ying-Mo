import { useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../auth/useAuth.js'
import ReportDialog from './ReportDialog.jsx'

export default function ReportButton({ targetType, targetId }) {
  const { isAuthenticated } = useAuth(); const location = useLocation(); const navigate = useNavigate(); const [open, setOpen] = useState(false)
  function start() { if (!isAuthenticated) { navigate(`/login?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`); return } setOpen(true) }
  return <>{<button type="button" className="report-button" onClick={start}>举报</button>}{open && <ReportDialog targetType={targetType} targetId={targetId} onClose={() => setOpen(false)} />}</>
}
