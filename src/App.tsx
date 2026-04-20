import { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import MainAppPage from './pages/MainAppPage';

const isAuthenticated = () => {
  const token = localStorage.getItem('spotify_access_token');
  const refreshToken = localStorage.getItem('spotify_refresh_token');
  return token !== null || refreshToken !== null;
};

function App() {
  const [isAuth, setIsAuth] = useState(() => {
    const initialAuth = isAuthenticated();
    return initialAuth;
  });

  useEffect(() => {
    const handleAuthChange = () => {
      const currentAuthStatus = isAuthenticated();
      setIsAuth(currentAuthStatus);
    };

    window.addEventListener('authChange', handleAuthChange);

    const exchangeCodeForToken = async (code: string, receivedState: string) => {
      const storedState = localStorage.getItem('spotify_auth_state');
      const codeVerifier = localStorage.getItem('spotify_code_verifier');

      if (receivedState === null || receivedState !== storedState) {
        console.error('[App exchangeCodeForToken] State mismatch. Aborting token exchange. Received:', receivedState, 'Stored:', storedState);
        localStorage.removeItem('spotify_auth_state');
        localStorage.removeItem('spotify_code_verifier');
        window.history.replaceState({}, document.title, window.location.pathname);
        setIsAuth(false);
        return;
      }
      localStorage.removeItem('spotify_auth_state');

      if (!codeVerifier) {
        console.error('[App exchangeCodeForToken] Code verifier not found. Aborting token exchange.');
        window.history.replaceState({}, document.title, window.location.pathname);
        setIsAuth(false);
        return;
      }

      const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
      const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;

      if (!clientId || !redirectUri) {
        console.error("[App exchangeCodeForToken] Spotify client ID or redirect URI not found for token exchange.");
        localStorage.removeItem('spotify_code_verifier');
        window.history.replaceState({}, document.title, window.location.pathname);
        setIsAuth(false);
        return;
      }

      const payload = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }),
      };

      try {
        const response = await fetch('https://accounts.spotify.com/api/token', payload);
        const data = await response.json();

        if (response.ok && data.access_token) {
          localStorage.setItem('spotify_access_token', data.access_token);
          if (data.refresh_token) {
            localStorage.setItem('spotify_refresh_token', data.refresh_token);
          }
          if (data.expires_in) {
            const expiresAt = Date.now() + data.expires_in * 1000;
            localStorage.setItem('spotify_token_expires_at', String(expiresAt));
          }
          localStorage.removeItem('spotify_code_verifier');
          window.dispatchEvent(new Event('authChange'));
        } else {
          console.error('[App exchangeCodeForToken] Failed to get access token. Response not OK or no access_token in data.', data);
          localStorage.removeItem('spotify_code_verifier');
          setIsAuth(false);
        }
      } catch (error) {
        console.error('[App exchangeCodeForToken] Error during token exchange fetch operation:', error);
        localStorage.removeItem('spotify_code_verifier');
        setIsAuth(false);
      } finally {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      console.error('[App useEffect] Spotify authentication error from URL:', error);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (code && state) {
      if (!isAuthenticated()) {
        exchangeCodeForToken(code, state);
      } else {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } else if (isAuthenticated()) {
    } else {
    }

    return () => {
      window.removeEventListener('authChange', handleAuthChange);
    };
  }, []); // Run once on component mount

  const handleLogout = () => {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('spotify_token_expires_at');
    localStorage.removeItem('spotify_code_verifier');
    localStorage.removeItem('spotify_auth_state');
    window.dispatchEvent(new Event('authChange'));
  };

  if (isAuth) {
    return <MainAppPage onLogout={handleLogout} />;
  }

  return <LoginPage />;
}

export default App;
