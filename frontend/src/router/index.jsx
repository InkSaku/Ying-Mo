import { createBrowserRouter } from 'react-router-dom'
import BaseLayout from '../layouts/BaseLayout'
import HomePage from '../pages/HomePage'
import NotFoundPage from '../pages/NotFoundPage'
import AboutPage from '../pages/AboutPage.jsx'
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
import GamesPage from '../pages/GamesPage'
import GameDetailPage from '../pages/GameDetailPage'
import { GameHeroDetailPage, GameHeroesPage, GameMapDetailPage, GameMapsPage, GamePointListPage } from '../pages/GameCatalogPages'
import GuidesPage from '../pages/GuidesPage'
import GuideEditorPage from '../pages/GuideEditorPage'
import GuideDetailPage from '../pages/GuideDetailPage'
import PublishPage from '../pages/PublishPage'
import ProtectedRoute from './ProtectedRoute'
import GuestRoute from './GuestRoute'
import NotificationsPage from '../pages/NotificationsPage.jsx'
import FavoritesPage from '../pages/FavoritesPage.jsx'
import MyCommentsPage from '../pages/MyCommentsPage.jsx'
import DiscoverPage from '../pages/DiscoverPage.jsx'
import SearchPage from '../pages/SearchPage.jsx'
import PersonalCenterLayout from '../layouts/PersonalCenterLayout.jsx'
import PersonalDashboardPage from '../pages/PersonalDashboardPage.jsx'
import DraftsPage from '../pages/DraftsPage.jsx'
import { HiddenContentPage, MyGuidesPage, MyLifePostsPage } from '../pages/MyContentPages.jsx'
import ReviewingPage from '../pages/ReviewingPage.jsx'
import AdminRoute, { SystemAdminRoute } from './AdminRoute.jsx'
import AdminLayout from '../layouts/AdminLayout.jsx'
import { AdminCatalogPage, AdminChaptersPage, AdminContentPage, AdminDashboardPage, AdminLogsPage, AdminReportDetailPage, AdminReportsPage, AdminUserDetailPage, AdminUsersPage } from '../pages/AdminPages.jsx'

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
      { path: '/games', element: <GamesPage /> },
      { path: '/game/:gameSlug', element: <GameDetailPage /> },
      { path: '/game/:gameSlug/heroes', element: <GameHeroesPage /> },
      { path: '/game/:gameSlug/maps', element: <GameMapsPage /> },
      { path: '/game/:gameSlug/hero/:heroSlug', element: <GameHeroDetailPage /> },
      { path: '/game/:gameSlug/map/:mapSlug', element: <GameMapDetailPage /> },
      { path: '/game/:gameSlug/map/:mapSlug/hero/:heroSlug', element: <GamePointListPage /> },
      { path: '/guides', element: <GuidesPage /> },
      { path: '/guide/create', element: <ProtectedRoute><GuideEditorPage /></ProtectedRoute> },
      { path: '/guide/:id', element: <GuideDetailPage /> },
      { path: '/guide/:id/edit', element: <ProtectedRoute><GuideEditorPage edit /></ProtectedRoute> },
      { path: '/discover', element: <DiscoverPage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/publish', element: <ProtectedRoute><PublishPage /></ProtectedRoute> },
      { path: '/login', element: <GuestRoute><LoginPage /></GuestRoute> },
      { path: '/register', element: <GuestRoute><RegisterPage /></GuestRoute> },
      { path: '/notifications', element: <ProtectedRoute><NotificationsPage /></ProtectedRoute> },
      { path: '/me', element: <ProtectedRoute><PersonalCenterLayout /></ProtectedRoute>, children: [
        { index: true, element: <PersonalDashboardPage /> },
        { path: 'posts', element: <MyLifePostsPage /> },
        { path: 'guides', element: <MyGuidesPage /> },
        { path: 'drafts', element: <DraftsPage /> },
        { path: 'reviewing', element: <ReviewingPage /> },
        { path: 'hidden', element: <HiddenContentPage /> },
        { path: 'favorites', element: <FavoritesPage /> },
        { path: 'comments', element: <MyCommentsPage /> },
        { path: 'settings', element: <ProfileSettingsPage /> },
      ] },
      { path: '/admin', element: <AdminRoute><AdminLayout /></AdminRoute>, children: [
        { index: true, element: <AdminDashboardPage /> },
        { path: 'reports', element: <AdminReportsPage /> },
        { path: 'reports/:id', element: <AdminReportDetailPage /> },
        { path: 'users', element: <AdminUsersPage /> },
        { path: 'users/:id', element: <AdminUserDetailPage /> },
        { path: 'content', element: <AdminContentPage /> },
        { path: 'chapters', element: <AdminChaptersPage /> },
        { path: 'catalog', element: <AdminCatalogPage /> },
        { path: 'logs', element: <SystemAdminRoute><AdminLogsPage /></SystemAdminRoute> },
      ] },
      { path: '/user/:username', element: <UserProfilePage /> },
      { path: '/about', element: <AboutPage /> },
      { path: '/404', element: <NotFoundPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
