const BASE = '/api'

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'same-origin',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Error del servidor')
  return data
}

export const api = {
  auth: {
    login: (username, password) =>
      request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    check: () => request('/auth/check'),
    changePassword: (currentPassword, newPassword) =>
      request('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
  },
  files: {
    list: (path = '', mount = 'internal') =>
      request(`/files/list?path=${encodeURIComponent(path)}&mount=${encodeURIComponent(mount)}`),
    stats: () => request('/files/stats'),
    search: (q, mount = 'internal') =>
      request(`/files/search?q=${encodeURIComponent(q)}&mount=${encodeURIComponent(mount)}`),
    read: (path, mount = 'internal') =>
      request(`/files/read?path=${encodeURIComponent(path)}&mount=${encodeURIComponent(mount)}`),
    save: (path, content, mount = 'internal') =>
      request('/files/save', {
        method: 'POST',
        body: JSON.stringify({ path, content, mount }),
      }),
    createFile: (name, directory = '', mount = 'internal') =>
      request('/files/create-file', {
        method: 'POST',
        body: JSON.stringify({ name, directory, mount }),
      }),
    mkdir: (name, directory = '', mount = 'internal') =>
      request('/files/mkdir', {
        method: 'POST',
        body: JSON.stringify({ name, directory, mount }),
      }),
    rename: (oldPath, newName, mount = 'internal') =>
      request('/files/rename', {
        method: 'POST',
        body: JSON.stringify({ oldPath, newName, mount }),
      }),
    delete: (path, mount = 'internal') =>
      request('/files/delete', {
        method: 'POST',
        body: JSON.stringify({ path, mount }),
      }),
    move: (source, destination, mount = 'internal') =>
      request('/files/move', {
        method: 'POST',
        body: JSON.stringify({ source, destination, mount }),
      }),
    extract: (path, mount = 'internal', destination) =>
      request('/files/extract', {
        method: 'POST',
        body: JSON.stringify({ path, mount, destination }),
      }),
    download: (path, mount = 'internal') => {
      window.open(`${BASE}/files/download?path=${encodeURIComponent(path)}&mount=${encodeURIComponent(mount)}`, '_blank')
    },
    upload: (formData, onProgress) => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `${BASE}/files/upload`)
        xhr.withCredentials = true
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress(Math.round((e.loaded / e.total) * 100))
          }
        })
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText)
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(data)
            } else {
              reject(new Error(data.error || 'Upload failed'))
            }
          } catch {
            reject(new Error('Upload failed'))
          }
        }
        xhr.onerror = () => reject(new Error('Network error'))
        xhr.send(formData)
      })
    },
  },
  linked: {
    list: () => request('/linked'),
    add: (name, path) =>
      request('/linked', { method: 'POST', body: JSON.stringify({ name, path }) }),
    remove: (id) => request(`/linked/${id}`, { method: 'DELETE' }),
    get: (id) => request(`/linked/${id}`),
    browse: (path = '') => request(`/linked/browse?path=${encodeURIComponent(path)}`),
  },
  minecraft: {
    detect: (mount, depth) => request(`/minecraft/detect?mount=${encodeURIComponent(mount)}${depth ? `&depth=${depth}` : ''}`),
    getProperties: (dirPath) => request(`/minecraft/server-properties?path=${encodeURIComponent(dirPath)}`),
    saveProperties: (dirPath, properties) =>
      request('/minecraft/server-properties', { method: 'POST', body: JSON.stringify({ dirPath, properties }) }),
    acceptEula: (dirPath) =>
      request('/minecraft/accept-eula', { method: 'POST', body: JSON.stringify({ dirPath }) }),
    propertyMeta: () => request('/minecraft/property-meta'),
    networkStatus: (dirPath) => request(`/minecraft/network-status?path=${encodeURIComponent(dirPath)}`),
    networkOptimize: (dirPath) =>
      request('/minecraft/network-optimize', { method: 'POST', body: JSON.stringify({ dirPath }) }),
    startServer: (dirPath, minMemory, maxMemory) =>
      request('/minecraft/server/start', { method: 'POST', body: JSON.stringify({ dirPath, minMemory, maxMemory }) }),
    stopServer: (dirPath) =>
      request('/minecraft/server/stop', { method: 'POST', body: JSON.stringify({ dirPath }) }),
    restartServer: (dirPath, minMemory, maxMemory) =>
      request('/minecraft/server/restart', { method: 'POST', body: JSON.stringify({ dirPath, minMemory, maxMemory }) }),
    sendCommand: (dirPath, command) =>
      request('/minecraft/server/command', { method: 'POST', body: JSON.stringify({ dirPath, command }) }),
    getServerLogs: (dirPath, lines = 200) =>
      request(`/minecraft/server/logs?path=${encodeURIComponent(dirPath)}&lines=${lines}`),
    getServerStatus: (dirPath) =>
      request(`/minecraft/server/status?path=${encodeURIComponent(dirPath)}`),
    getServerResources: (dirPath) =>
      request(`/minecraft/server/resources?path=${encodeURIComponent(dirPath)}`),
    getBackups: (dirPath) =>
      request(`/minecraft/backups?path=${encodeURIComponent(dirPath)}`),
    createBackup: (dirPath) =>
      request('/minecraft/backups/create', { method: 'POST', body: JSON.stringify({ dirPath }) }),
    deleteBackup: (dirPath, name) =>
      request('/minecraft/backups/delete', { method: 'POST', body: JSON.stringify({ dirPath, name }) }),
    downloadBackup: (dirPath, name) => {
      window.location.href = `/minecraft/backups/download?path=${encodeURIComponent(dirPath)}&name=${encodeURIComponent(name)}`
    },
  },
  bots: {
    list: () => request('/bots'),
    create: (bot) => request('/bots', { method: 'POST', body: JSON.stringify(bot) }),
    update: (id, updates) => request(`/bots/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
    remove: (id) => request(`/bots/${id}`, { method: 'DELETE' }),
    start: (id) => request(`/bots/${id}/start`, { method: 'POST' }),
    stop: (id) => request(`/bots/${id}/stop`, { method: 'POST' }),
    restart: (id) => request(`/bots/${id}/restart`, { method: 'POST' }),
    install: (id) => request(`/bots/${id}/install`, { method: 'POST' }),
    logs: (id, lines = 100) => request(`/bots/${id}/logs?lines=${lines}`),
    status: (id) => request(`/bots/${id}/status`),
    detect: (mount, depth) => request(`/bots/detect?mount=${encodeURIComponent(mount)}${depth ? `&depth=${depth}` : ''}`),
    languages: () => request('/bots/languages'),
    pythonVersions: () => request('/bots/python-versions'),
  },
}
