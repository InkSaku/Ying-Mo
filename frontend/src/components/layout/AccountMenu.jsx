import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

export default function AccountMenu({
  user,
  isAdmin,
  isLoggingOut,
  onLogout,
  onNavigate,
}) {
  const menuId = useId()
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const [open, setOpen] = useState(false)
  const displayName = user.nickname || user.username

  useEffect(() => {
    if (!open) return undefined

    function closeFromOutside(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }

    function closeFromEscape(event) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', closeFromOutside)
    window.addEventListener('keydown', closeFromEscape)
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside)
      window.removeEventListener('keydown', closeFromEscape)
    }
  }, [open])

  function items() {
    return Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]:not(:disabled)') || [])
  }

  function focusItem(position) {
    window.setTimeout(() => {
      const menuItems = items()
      if (!menuItems.length) return
      const index = position === 'last' ? menuItems.length - 1 : 0
      menuItems[index].focus()
    }, 0)
  }

  function toggleMenu() {
    setOpen((current) => !current)
  }

  function handleTriggerKeyDown(event) {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return
    event.preventDefault()
    setOpen(true)
    focusItem(event.key === 'ArrowUp' ? 'last' : 'first')
  }

  function handleMenuKeyDown(event) {
    const menuItems = items()
    if (!menuItems.length) return
    const currentIndex = menuItems.indexOf(document.activeElement)
    let nextIndex = null

    if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % menuItems.length
    if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + menuItems.length) % menuItems.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = menuItems.length - 1
    if (nextIndex === null) return

    event.preventDefault()
    menuItems[nextIndex]?.focus()
  }

  function closeAndNavigate() {
    setOpen(false)
    onNavigate()
  }

  async function logout() {
    try {
      await onLogout()
    } finally {
      setOpen(false)
    }
  }

  return (
    <div className={`account-menu${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        className="account-menu__trigger"
        type="button"
        ref={triggerRef}
        aria-label={`${open ? '关闭' : '打开'}${displayName}的账户菜单`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={toggleMenu}
        onKeyDown={handleTriggerKeyDown}
      >
        {user.avatar_url ? (
          <img className="account-menu__avatar" src={user.avatar_url} alt="" />
        ) : (
          <span className="account-menu__avatar" aria-hidden="true">
            {displayName.slice(0, 1)}
          </span>
        )}
        <span className="account-menu__chevron" aria-hidden="true">⌄</span>
      </button>

      {open && (
        <div
          className="account-menu__panel"
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label="账户菜单"
          onKeyDown={handleMenuKeyDown}
        >
          <div className="account-menu__identity">
            {user.avatar_url ? (
              <img className="account-menu__avatar account-menu__avatar--large" src={user.avatar_url} alt="" />
            ) : (
              <span className="account-menu__avatar account-menu__avatar--large" aria-hidden="true">
                {displayName.slice(0, 1)}
              </span>
            )}
            <span>
              <strong>{displayName}</strong>
              <small>@{user.username}</small>
            </span>
          </div>

          <div className="account-menu__links">
            <Link role="menuitem" className="account-menu__item" to={`/user/${encodeURIComponent(user.username)}`} onClick={closeAndNavigate}>
              <span>我的主页</span>
              <small>查看公开资料和内容</small>
            </Link>
            <Link role="menuitem" className="account-menu__item" to="/me" onClick={closeAndNavigate}>
              <span>个人中心</span>
              <small>管理内容、收藏和设置</small>
            </Link>
            {isAdmin && (
              <Link role="menuitem" className="account-menu__item" to="/admin" onClick={closeAndNavigate}>
                <span>管理后台</span>
                <small>内容治理与系统管理</small>
              </Link>
            )}
          </div>

          <button
            role="menuitem"
            className="account-menu__item account-menu__logout"
            type="button"
            disabled={isLoggingOut}
            onClick={() => void logout()}
          >
            <span>{isLoggingOut ? '正在退出…' : '退出登录'}</span>
          </button>
        </div>
      )}
    </div>
  )
}
