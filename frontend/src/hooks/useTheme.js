import { useEffect, useState } from 'react'

const THEME_STORAGE_KEY = 'yingmo-theme'

function getInitialTheme() {
  const savedTheme = typeof window.localStorage?.getItem === 'function'
    ? window.localStorage.getItem(THEME_STORAGE_KEY)
    : null
  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme
  }

  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export default function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'dark' ? '#171c18' : '#2f8373',
    )
    if (typeof window.localStorage?.setItem === 'function') {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))
  }

  return { theme, toggleTheme }
}
