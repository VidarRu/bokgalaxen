// Anropen till serverfunktionerna i api/. Alla svar och fel är på svenska.

async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    // inget JSON-svar: servern finns inte, till exempel på en sida utan api/
  }
  if (!response.ok || data === null) {
    const error = new Error(data?.error ?? `Servern svarade inte som väntat (${response.status}).`);
    error.status = response.status;
    error.noServer = data === null;
    throw error;
  }
  return data;
}

export const remoteApi = {
  loadGalaxy: () => api('/api/galaxy'),
  savePatch: (patch) => api('/api/galaxy', { method: 'POST', body: { patch } }),
  savePositions: (positions, overwrite = false) => api('/api/galaxy', { method: 'POST', body: { positions, overwrite } }),
  me: () => api('/api/me'),
  login: (username, password) => api('/api/login', { method: 'POST', body: { username, password } }),
  logout: () => api('/api/logout', { method: 'POST', body: {} }),
  setSignature: (signature) => api('/api/me', { method: 'PATCH', body: { signature } }),
  changePassword: (current, next) => api('/api/me', { method: 'POST', body: { current, next } }),
  listUsers: () => api('/api/users'),
  createUser: (user) => api('/api/users', { method: 'POST', body: user }),
  updateUser: (changes) => api('/api/users', { method: 'PATCH', body: changes }),
  deleteUser: (id) => api('/api/users', { method: 'DELETE', body: { id } }),
};
