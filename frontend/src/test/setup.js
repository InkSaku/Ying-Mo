import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())

if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:yingmo-test-preview'
}

if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = () => {}
}
