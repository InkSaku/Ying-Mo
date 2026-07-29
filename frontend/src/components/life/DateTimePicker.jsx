import { useEffect, useMemo, useRef, useState } from 'react'


const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const HOURS = Array.from({ length: 24 }, (_, index) => index)
const MINUTES = Array.from({ length: 60 }, (_, index) => index)

function pad(value) {
  return String(value).padStart(2, '0')
}

function parseLocalDateTime(value) {
  if (!value) return null
  const matched = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!matched) return null
  const [, year, month, day, hour, minute] = matched.map(Number)
  const date = new Date(year, month - 1, day, hour, minute)
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
    || date.getHours() !== hour
    || date.getMinutes() !== minute
  ) return null
  return date
}

function localValue(date) {
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join('T')
}

function displayValue(value) {
  const date = parseLocalDateTime(value)
  if (!date) return ''
  const weekday = `周${WEEKDAYS[date.getDay()]}`
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${weekday} · ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function sameDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate()
  )
}

function calendarDays(viewMonth) {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

export default function DateTimePicker({ value, onChange }) {
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => parseLocalDateTime(value) || new Date())
  const [viewMonth, setViewMonth] = useState(() => {
    const initial = parseLocalDateTime(value) || new Date()
    return new Date(initial.getFullYear(), initial.getMonth(), 1)
  })
  const days = useMemo(() => calendarDays(viewMonth), [viewMonth])
  const formatted = displayValue(value)

  useEffect(() => {
    if (!open) return undefined

    function closeOnOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutside)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  function openPicker() {
    const next = parseLocalDateTime(value) || new Date()
    next.setSeconds(0, 0)
    setDraft(next)
    setViewMonth(new Date(next.getFullYear(), next.getMonth(), 1))
    setOpen(true)
  }

  function changeMonth(offset) {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  function chooseDate(date) {
    setDraft((current) => new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      current.getHours(),
      current.getMinutes(),
    ))
    if (date.getMonth() !== viewMonth.getMonth()) {
      setViewMonth(new Date(date.getFullYear(), date.getMonth(), 1))
    }
  }

  function chooseNow() {
    const now = new Date()
    now.setSeconds(0, 0)
    setDraft(now)
    setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1))
  }

  function changeTime(part, rawValue) {
    const nextValue = Number(rawValue)
    setDraft((current) => {
      const next = new Date(current)
      if (part === 'hour') next.setHours(nextValue)
      else next.setMinutes(nextValue)
      return next
    })
  }

  return (
    <div className="date-time-picker" ref={rootRef}>
      <span className="life-editor__field-label">拍摄或发生时间</span>
      <button
        type="button"
        className={`date-time-picker__trigger${formatted ? ' has-value' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPicker())}
      >
        <span className="date-time-picker__trigger-copy">
          <strong>{formatted || '选择日期和时间'}</strong>
          <small>{formatted ? '点击可以重新选择' : '可选，也可以稍后再补充'}</small>
        </span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v12H4V7a2 2 0 0 1 2-2Z" />
        </svg>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="date-time-picker__backdrop"
            aria-label="关闭日期选择器"
            onClick={() => setOpen(false)}
          />
          <section
            className="date-time-picker__popover"
            role="dialog"
            aria-modal="true"
            aria-label="选择拍摄或发生时间"
          >
            <header className="date-time-picker__header">
              <button type="button" aria-label="上个月" onClick={() => changeMonth(-1)}>‹</button>
              <strong>{viewMonth.getFullYear()}年 {viewMonth.getMonth() + 1}月</strong>
              <button type="button" aria-label="下个月" onClick={() => changeMonth(1)}>›</button>
              <button type="button" className="date-time-picker__now" onClick={chooseNow}>此刻</button>
            </header>

            <div className="date-time-picker__weekdays" aria-hidden="true">
              {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
            </div>

            <div className="date-time-picker__days">
              {days.map((date) => {
                const selected = sameDay(date, draft)
                const today = sameDay(date, new Date())
                const outside = date.getMonth() !== viewMonth.getMonth()
                const label = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
                return (
                  <button
                    type="button"
                    className={[
                      selected ? 'is-selected' : '',
                      today ? 'is-today' : '',
                      outside ? 'is-outside' : '',
                    ].filter(Boolean).join(' ')}
                    aria-label={label}
                    aria-pressed={selected}
                    key={`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
                    onClick={() => chooseDate(date)}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>

            <div className="date-time-picker__time">
              <span aria-hidden="true">◷</span>
              <strong>时间</strong>
              <label>
                <span className="sr-only">小时</span>
                <select
                  aria-label="小时"
                  value={draft.getHours()}
                  onChange={(event) => changeTime('hour', event.target.value)}
                >
                  {HOURS.map((hour) => <option value={hour} key={hour}>{pad(hour)}</option>)}
                </select>
              </label>
              <em>:</em>
              <label>
                <span className="sr-only">分钟</span>
                <select
                  aria-label="分钟"
                  value={draft.getMinutes()}
                  onChange={(event) => changeTime('minute', event.target.value)}
                >
                  {MINUTES.map((minute) => <option value={minute} key={minute}>{pad(minute)}</option>)}
                </select>
              </label>
            </div>

            <footer className="date-time-picker__actions">
              <button
                type="button"
                className="date-time-picker__clear"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
              >
                清除
              </button>
              <span />
              <button type="button" onClick={() => setOpen(false)}>取消</button>
              <button
                type="button"
                className="button button--primary"
                onClick={() => {
                  onChange(localValue(draft))
                  setOpen(false)
                }}
              >
                确定
              </button>
            </footer>
          </section>
        </>
      )}
    </div>
  )
}
