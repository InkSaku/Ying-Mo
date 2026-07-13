/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSearchSuggestions } from '../../api/search.js'

export default function GlobalSearch() {
  const navigate = useNavigate(); const listId = useId(); const root = useRef(null); const [value, setValue] = useState(''); const [items, setItems] = useState([]); const [open, setOpen] = useState(false); const [active, setActive] = useState(-1)
  useEffect(() => { if (!value.trim()) { setItems([]); setOpen(false); return undefined } const controller = new AbortController(); const timer = window.setTimeout(() => { getSearchSuggestions(value.trim(), 8, controller.signal).then((data) => { setItems(data); setOpen(true); setActive(-1) }).catch(() => {}) }, 300); return () => { controller.abort(); clearTimeout(timer) } }, [value])
  useEffect(() => { const outside = (event) => { if (!root.current?.contains(event.target)) setOpen(false) }; document.addEventListener('mousedown', outside); return () => document.removeEventListener('mousedown', outside) }, [])
  function submit(event) { event.preventDefault(); const item = items[active]; if (item) navigate(item.url); else if (value.trim()) navigate(`/search?q=${encodeURIComponent(value.trim())}&scope=all`); setOpen(false) }
  function keyDown(event) { if (event.key === 'Escape') setOpen(false); if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive((current) => Math.min(items.length - 1, current + 1)) } if (event.key === 'ArrowUp') { event.preventDefault(); setActive((current) => Math.max(-1, current - 1)) } }
  return <div className="global-search" ref={root}><form onSubmit={submit}><input value={value} onChange={(event) => setValue(event.target.value)} onFocus={() => items.length && setOpen(true)} onKeyDown={keyDown} placeholder="搜索映墨" aria-label="全站搜索" aria-expanded={open} aria-controls={listId} aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined} /><button type="submit" aria-label="提交搜索">搜索</button></form>{open && items.length > 0 && <div id={listId} className="global-search__suggestions" role="listbox">{items.map((item, index) => <button id={`${listId}-${index}`} role="option" aria-selected={active === index} key={`${item.type}-${item.url}`} type="button" onMouseDown={() => navigate(item.url)}><strong>{item.label}</strong><span>{item.subtitle}</span></button>)}</div>}</div>
}
