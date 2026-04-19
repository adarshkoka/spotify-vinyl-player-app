// src/pages/LoginPage.tsx
import React from 'react';
import { generateCodeVerifier, generateCodeChallenge } from '../utils/auth';

const LoginPage: React.FC = () => {
  const handleLogin = async () => {
    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      console.error("Spotify client ID or redirect URI not found in environment variables.");
      // Optionally, display an error message to the user
      return;
    }

    const codeVerifier = generateCodeVerifier();
    localStorage.setItem('spotify_code_verifier', codeVerifier);

    // Generate and store state
    const state = generateCodeVerifier(); // Can reuse the same function for a random string
    localStorage.setItem('spotify_auth_state', state);

    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const scope = 'user-read-currently-playing user-read-playback-state user-modify-playback-state';

    const authUrl = new URL("https://accounts.spotify.com/authorize");
    const params = {
      response_type: 'code',
      client_id: clientId,
      scope: scope,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      redirect_uri: redirectUri,
      state: state, // Add state to parameters
    };
    authUrl.search = new URLSearchParams(params).toString();

    window.location.href = authUrl.toString();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-spotify-black via-spotify-gray-dark to-spotify-gradient-dark-gray text-spotify-text p-6">
      <div className="bg-spotify-card bg-opacity-75 p-8 sm:p-10 rounded-xl shadow-2xl text-center max-w-md w-full">
        {/* <img src="/spotify-logo-pixel.png" alt="Spotify Pixelated Logo" className="w-24 h-24 mx-auto mb-6" /> */}
        <h1 
          className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6 md:mb-8 text-center bg-gradient-to-r from-spotify-green to-spotify-green-hover bg-clip-text text-transparent drop-shadow-sm">
          Spotify Vinyl Player
        </h1>
        <p className="text-spotify-text-subdued mb-8 text-sm sm:text-base">
          Connect your Spotify account to visualize your music on a virtual record player.
        </p>
        <button
          onClick={handleLogin}
          className="w-full bg-spotify-green hover:bg-spotify-green-hover text-black font-bold py-3 px-6 rounded-full text-lg transition duration-150 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-spotify-green-hover focus:ring-opacity-50 cursor-pointer"
        >
          Login with Spotify
        </button>
        <p className="text-xs text-spotify-text-subdued mt-8">
          This application uses the Spotify Web API to access your playback information. We do not store your Spotify data.
        </p>
      </div>
      <footer className="absolute bottom-4 text-center w-full text-xs text-spotify-text-subdued">
        Spotify Vinyl Player
      </footer>
    </div>
  );
};

export default LoginPage;
