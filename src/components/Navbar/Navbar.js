// src/components/Navbar.js
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext'; // Make sure you have AuthContext.js
import logo from '../../screen-copilot-extension/icons/Logo.png';
import '../../styles/components/Navbar.css';

const Navbar = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="header">
      <div className="container">
        <Link to="/" className="logo">
          <img src={logo} alt="NexAura Logo" />
          <h1>Nex<span className="logo-highlight">A</span>ura</h1>
        </Link>
        <nav>
          <Link to="/explore">Explore</Link>
          {token ? (
            <>
              <Link to="/my-guides">My Guides</Link>
              <button onClick={handleLogout} className="cta-button secondary">
                Log Out
              </button>
            </>
          ) : (
            <Link to="/login" className="cta-button primary">
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;