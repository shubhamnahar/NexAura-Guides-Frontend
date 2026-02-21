// src/App.js
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import './App.css'; 
import './LandingPage.css'; // Keep this for LandingPage styles

// Import Components
import Navbar from './components/Navbar';

// Import Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MyGuides from './pages/MyGuides';
import ExploreGuides from './pages/ExploreGuides';

function App() {
  return (
    <>
      <Navbar /> {/* The Navbar is now shared on every page */}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/my-guides" element={<MyGuides />} />
        <Route path="/explore" element={<ExploreGuides />} />
      </Routes>
    </>
  );
}

export default App;