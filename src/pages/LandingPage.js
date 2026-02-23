import React, { useEffect, useRef } from 'react';
import '../LandingPage.css'; 

function LandingPage() { 
  const CHROME_STORE_URL = "https://chrome.google.com/webstore/category/extensions"; // Replace with your actual store link
  const videoRef = useRef(null);

  // --- MODERN 3D BLUR SCROLL OBSERVER ---
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target); 
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: "0px 0px -50px 0px"
      }
    );

    const hiddenElements = document.querySelectorAll('.reveal-on-scroll');
    hiddenElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-page">
      {/* HERO SECTION */}
      <section className="hero">
        <div className="hero-glow"></div>
        <div className="container hero-container">
          
          <div className="hero-content">
            <div className="badge reveal-on-scroll">✨ Next-Gen Screen Copilot</div>
            <h1 className="reveal-on-scroll delay-100">
              Turn complex workflows into <br/>
              <span className="text-gradient">interactive guides.</span>
            </h1>
            <p className="subheader reveal-on-scroll delay-200">
              Record your actions on any web app. Instantly generate on-screen interactive walkthroughs, self-healing automations, and beautifully highlighted PDF documentation.
            </p>
            <div className="hero-actions reveal-on-scroll delay-300">
              <a href={CHROME_STORE_URL} className="cta-button primary">
                Add to Chrome for Free
              </a>
              <a href="#bento-features" className="cta-button secondary">
                See how it works
              </a>
            </div>
            
            <div className="hero-stats reveal-on-scroll delay-400">
              <div className="stat"><strong>0</strong> <span>Code Required</span></div>
              <div className="divider"></div>
              <div className="stat"><strong>100%</strong> <span>In-Browser</span></div>
              <div className="divider"></div>
              <div className="stat"><strong>SPA</strong> <span>& Iframe Ready</span></div>
            </div>
          </div>

          {/* VIDEO PROMINENTLY PLACED TO FIX BLANK SPACE */}
          <div className="hero-video-wrapper reveal-on-scroll delay-500">
            <div className="video-glass-frame">
              <video
                className="hero-video"
                ref={videoRef}
              src="/Video_Generation_With_User_Feedback.mp4"
                autoPlay
                muted
                loop
                playsInline
                controls
              >
                Your browser does not support the video tag.
              </video>
            </div>
          </div>

        </div>
      </section>

      {/* BENTO BOX FEATURES SECTION */}
      <section id="bento-features" className="bento-section">
        <div className="container">
          <div className="section-header reveal-on-scroll">
            <h2>Designed for the modern web.</h2>
            <p>Far beyond simple screen recording. NexAura understands the DOM, survives UI changes, and keeps the user in control.</p>
          </div>

          <div className="bento-grid">
            {/* Large Card */}
            <div className="bento-card large reveal-on-scroll delay-100">
              <div className="bento-icon">🎯</div>
              <h3>Human-in-the-Loop Playback</h3>
              <p>A true Copilot, not an autopilot. NexAura projects a glowing highlight exactly where the user needs to click, but waits for them to take the action. Perfect for secure portals, form filling, and real-time onboarding.</p>
              <div className="bento-visual human-loop-visual">
                <div className="mock-button glowing">Click to Submit</div>
                <div className="mock-cursor"></div>
              </div>
            </div>

            {/* Medium Card 1 */}
            <div className="bento-card reveal-on-scroll delay-200">
              <div className="bento-icon">📄</div>
              <h3>Instant PDF Docs</h3>
              <p>Every step you record is automatically compiled into a beautiful PDF. NexAura mathematically draws precision highlights over the exact elements you clicked.</p>
            </div>

            {/* Medium Card 2 */}
            <div className="bento-card reveal-on-scroll delay-300">
              <div className="bento-icon">🧠</div>
              <h3>Context-Aware AI</h3>
              <p>Stuck on a page? The AI takes a visual snapshot of your screen and provides answers based exactly on what you are looking at right now.</p>
            </div>

            {/* Wide Card */}
            <div className="bento-card wide reveal-on-scroll delay-100">
              <div className="wide-content">
                <div className="bento-icon">🩹</div>
                <div>
                  <h3>Self-Healing Repair UX</h3>
                  <p>Websites change constantly. If an element completely disappears, the guide doesn't just fail. Our Repair Overlay pauses the flow, shows you a screenshot of what it's looking for, and lets you manually select the new element—seamlessly updating the guide for everyone.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* UNDER THE HOOD - TECH SPECS */}
      <section className="tech-specs">
        <div className="container">
          <div className="section-header reveal-on-scroll">
            <h2>The Locator Engine</h2>
            <p>Why NexAura never loses its place, even on complex React applications.</p>
          </div>

          <div className="tech-grid">
            <div className="tech-card reveal-on-scroll delay-100">
              <h4>1. DOM Fingerprinting</h4>
              <p>We don't just save a CSS class. We capture ARIA labels, semantic roles, text nodes, and deeply nested Shadow DOM paths to ensure absolute precision.</p>
            </div>
            <div className="tech-card reveal-on-scroll delay-200">
              <h4>2. Smart Disambiguation</h4>
              <p>Multiple elements with the same class? NexAura uses fuzzy-text matching and parent-wrapper penalty algorithms to isolate the exact target.</p>
            </div>
            <div className="tech-card reveal-on-scroll delay-300">
              <h4>3. Computer Vision Fallback</h4>
              <p>If CSS completely breaks, our OpenCV-powered vision engine takes over, scanning the live page to find a pixel-perfect match of the recorded button.</p>
            </div>
            <div className="tech-card reveal-on-scroll delay-400">
              <h4>4. Cross-Frame Delegation</h4>
              <p>NexAura effortlessly passes guidance logic across domains, surviving complex nested iframes like embedded checkout flows or video players.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="flowline">
        <div className="container">
          <h2 className="reveal-on-scroll text-center">Record once. Play forever.</h2>
          <div className="flowline-track reveal-on-scroll delay-200">
            <div className="flow-node">
              <span>1</span>
              <h4>Capture</h4>
              <p>Hit record. Click through your workflow normally while NexAura silently maps the DOM.</p>
            </div>
            <div className="flow-node">
              <span>2</span>
              <h4>Contextualize</h4>
              <p>Add brief instructions and give your guide a quick slash command (e.g., /network).</p>
            </div>
            <div className="flow-node">
              <span>3</span>
              <h4>Guide</h4>
              <p>Type the shortcut. The Copilot draws glowing highlights leading you to the finish line.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer reveal-on-scroll">
        <div className="container">
          <div className="footer-content">
            <div className="footer-logo">NexAura</div>
            <p>&copy; {new Date().getFullYear()} NexAura. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
