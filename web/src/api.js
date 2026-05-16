// Tiny fetch helper. All requests are proxied through Vite's /api -> :5050.
const BASE = '/api'

async function handle(res) {
  const text = await res.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!res.ok) {
    const msg =
      (body && typeof body === 'object' && body.error) ||
      (typeof body === 'string' && body) ||
      `HTTP ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    err.body = body
    throw err
  }
  return body
}

export const api = {
  get(path) {
    return fetch(`${BASE}${path}`, { method: 'GET' }).then(handle)
  },
  post(path, json) {
    return fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(json ?? {}),
    }).then(handle)
  },
  postForm(path, formData) {
    return fetch(`${BASE}${path}`, {
      method: 'POST',
      body: formData,
    }).then(handle)
  },
}
