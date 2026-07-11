import { createBrowserRouter } from 'react-router-dom'
import BaseLayout from '../layouts/BaseLayout'
import HomePage from '../pages/HomePage'
import NotFoundPage from '../pages/NotFoundPage'
import ComingSoonPage from '../pages/ComingSoonPage'
import LoginPage from '../pages/LoginPage'
import RegisterPage from '../pages/RegisterPage'
import ProfileSettingsPage from '../pages/ProfileSettingsPage'
import UserProfilePage from '../pages/UserProfilePage'
import LifeHomePage from '../pages/LifeHomePage'
import LifePostEditorPage from '../pages/LifePostEditorPage'
import LifePostDetailPage from '../pages/LifePostDetailPage'
import LifeChaptersPage from '../pages/LifeChaptersPage'
import LifeChapterCreatePage from '../pages/LifeChapterCreatePage'
import LifeChapterDetailPage from '../pages/LifeChapterDetailPage'
import ProtectedRoute from './ProtectedRoute'
import GuestRoute from './GuestRoute'

export const router = createBrowserRouter([
  {
    element: <BaseLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/life', element: <LifeHomePage /> },
      { path: '/life/create', element: <ProtectedRoute><LifePostEditorPage /></ProtectedRoute> },
      { path: '/life/post/:id', element: <LifePostDetailPage /> },
      { path: '/life/post/:id/edit', element: <ProtectedRoute><LifePostEditorPage edit /></ProtectedRoute> },
      { path: '/life/chapters', element: <LifeChaptersPage /> },
      { path: '/life/chapters/create', element: <ProtectedRoute><LifeChapterCreatePage /></ProtectedRoute> },
      { path: '/life/chapter/:slug', element: <LifeChapterDetailPage /> },
      { path: '/games', element: <ComingSoonPage /> },
      { path: '/discover', element: <ComingSoonPage /> },
      { path: '/publish', element: <ProtectedRoute><LifePostEditorPage /></ProtectedRoute> },
      { path: '/login', element: <GuestRoute><LoginPage /></GuestRoute> },
      { path: '/register', element: <GuestRoute><RegisterPage /></GuestRoute> },
      { path: '/me/settings', element: <ProtectedRoute><ProfileSettingsPage /></ProtectedRoute> },
      { path: '/user/:username', element: <UserProfilePage /> },
      { path: '/about', element: <ComingSoonPage /> },
      { path: '/404', element: <NotFoundPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
