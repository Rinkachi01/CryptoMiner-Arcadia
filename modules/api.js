const API_URL = '/api';

export async function apiCall(endpoint, body = {}) {
    const username = localStorage.getItem('username');
    if (!username) return { error: true, message: "Not logged in" };
    
    body.username = username;
    
    try {
        const response = await fetch(`${API_URL}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return { error: true, message: "Network error" };
    }
}

export async function fetchCatalog() {
    const response = await fetch(`${API_URL}/catalog`);
    return await response.json();
}

export async function fetchStatus() {
    const username = localStorage.getItem('username');
    if (!username) return { error: true };
    
    const response = await fetch(`${API_URL}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
    });
    return await response.json();
}

export async function fetchGameLevels() {
    const username = localStorage.getItem('username');
    if (!username) return {};
    
    const response = await fetch(`${API_URL}/game-levels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
    });
    return await response.json();
}