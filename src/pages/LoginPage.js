import React, { useState, useEffect } from 'react'; // Import useEffect
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { endpoints } from '../services/api';
import '../styles/pages/Auth.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth(); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // --- NEW: Listen for the "thank you" from content.js ---
  useEffect(() => {
    const handleMessage = (event) => {
      // We don't need to check origin, just the message type
      if (event.data && event.data.type === "NEXAURA_TOKEN_RECEIVED") {
        console.log("Login Page: content.js confirmed token receipt.");
        // Token is saved, we can now navigate
        navigate('/'); 
      }
    };
    window.addEventListener("message", handleMessage);
    // Cleanup listener when component unmounts
    return () => window.removeEventListener("message", handleMessage);
  }, [navigate]); // Add navigate as a dependency

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    try {
      const response = await fetch(endpoints.auth.login, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to login');
      }

      const data = await response.json();
      const token = data.access_token;

      // --- *** THIS IS THE NEW ROBUST FIX *** ---
      
      // 1. TELL REACT STATE ABOUT THE NEW TOKEN
      login(token); 
      
      // 2. Try to send the token to content.js.
      // We will retry every 100ms until content.js replies.
      const message = { 
        type: "NEXAURA_AUTH_TOKEN", 
        token: token
      };

      let attempts = 0;
      const intervalId = setInterval(() => {
        if (attempts > 50) { // Stop after 5 seconds
          clearInterval(intervalId);
          setError("Could not connect to extension. Please reload the page and try again.");
          return;
        }
        
        console.log("Login Page: Sending token to content.js...");
        // Send to all origins (*) because content.js is not a "page"
        window.postMessage(message, "*"); 
        attempts++;
      }, 100);

      // We will be navigated away by the useEffect listener
      // when it receives "NEXAURA_TOKEN_RECEIVED"

      // --- *** END OF FIX *** ---

    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1 className="auth-title">Log In to Nex<span className="logo-highlight">A</span>ura</h1>
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <p className="auth-error">{error}</p>}
          
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="cta-button primary auth-button">
            Log In
          </button>
        </form>
        <p className="auth-switch">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;