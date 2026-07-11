import { createBrowserRouter } from 'react-router-dom'
import BaseLayout from '../layouts/BaseLayout'
import HomePage from '../pages/HomePage'
import NotFoundPage from '../pages/NotFoundPage'
import ComingSoonPage from '../pages/ComingSoonPage'

export const router = createBrowserRouter([
  {
    element: <BaseLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/life', element: <ComingSoonPage /> },
      { path: '/games', element: <ComingSoonPage /> },
      { path: '/discover', element: <ComingSoonPage /> },
      { path: '/publish', element: <ComingSoonPage /> },
      { path: '/about', element: <ComingSoonPage /> },
      { path: '/404', element: <NotFoundPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
