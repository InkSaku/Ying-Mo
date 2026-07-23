import { apiClient } from './client.js'

function params(query) { return { params: Object.fromEntries(Object.entries(query || {}).filter(([, value]) => value !== '' && value != null)) } }
export async function getGames(query) { const { data } = await apiClient.get('/games', params(query)); return data }
export async function getGame(slug) { const { data } = await apiClient.get(`/games/${encodeURIComponent(slug)}`); return data.data }
export async function checkGameName(query) { const { data } = await apiClient.get('/games/check-name', params(query)); return data.data }
export async function getGameHeroes(slug, query) { const { data } = await apiClient.get(`/games/${encodeURIComponent(slug)}/heroes`, params(query)); return data }
export async function getGameHero(slug, heroSlug) { const { data } = await apiClient.get(`/games/${encodeURIComponent(slug)}/heroes/${encodeURIComponent(heroSlug)}`); return data.data }
export async function checkGameHeroName(slug, query) { const { data } = await apiClient.get(`/games/${encodeURIComponent(slug)}/heroes/check-name`, params(query)); return data.data }
export async function getGameMaps(slug, query) { const { data } = await apiClient.get(`/games/${encodeURIComponent(slug)}/maps`, params(query)); return data }
export async function getGameMap(slug, mapSlug) { const { data } = await apiClient.get(`/games/${encodeURIComponent(slug)}/maps/${encodeURIComponent(mapSlug)}`); return data.data }
export async function getGameMapHeroes(slug, mapSlug, query) { const { data } = await apiClient.get(`/games/${encodeURIComponent(slug)}/maps/${encodeURIComponent(mapSlug)}/heroes`, params(query)); return data }
export async function checkGameMapName(slug, query) { const { data } = await apiClient.get(`/games/${encodeURIComponent(slug)}/maps/check-name`, params(query)); return data.data }
export async function createGame(payload) { const { data } = await apiClient.post('/games', payload); return data.data }
export async function updateGame(id, payload) { const { data } = await apiClient.patch(`/games/${id}`, payload); return data.data }
export async function createGameHero(gameId, payload) { const { data } = await apiClient.post(`/games/${gameId}/heroes`, payload); return data.data }
export async function updateGameHero(gameId, heroId, payload) { const { data } = await apiClient.patch(`/games/${gameId}/heroes/${heroId}`, payload); return data.data }
export async function createGameMap(gameId, payload) { const { data } = await apiClient.post(`/games/${gameId}/maps`, payload); return data.data }
export async function updateGameMap(gameId, mapId, payload) { const { data } = await apiClient.patch(`/games/${gameId}/maps/${mapId}`, payload); return data.data }
