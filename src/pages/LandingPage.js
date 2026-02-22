import React, { useEffect } from 'react';
import '../LandingPage.css'; 

function LandingPage() { 
  const CHROME_STORE_URL = "https://chrome.google.com/webstore/category/extensions"; // Replace with your actual store link

  // --- APPLE-STYLE SCROLL OBSERVER ---
  useEffect(() => {
    // Setup the observer to watch elements
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // When the element crosses into the viewport
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            // Optional: stop observing once it's visible so it doesn't re-animate on scroll up
            observer.unobserve(entry.target); 
          }
        });
      },
      {
        threshold: 0.1, // Trigger when 10% of the element is visible
        rootMargin: "0px 0px -50px 0px" // Trigger slightly before it fully hits the bottom
      }
    );

    // Grab all elements with the reveal class and observe them
    const hiddenElements = document.querySelectorAll('.reveal-on-scroll');
    hiddenElements.forEach((el) => observer.observe(el));

    // Cleanup observer on component unmount
    return () => observer.disconnect();
  }, []);
  // -----------------------------------

  return (
    <div className="landing-page">
      <section className="hero">
        <div className="container">
          <div className="badge reveal-on-scroll">Screen Copilot Extension</div>
          <h2 className="reveal-on-scroll delay-100">Turn any web workflow into an interactive guide.</h2>
          <p className="subheader reveal-on-scroll delay-200">
            Record your actions on any complex web app. Instantly generate on-screen interactive walkthroughs, AI-powered chat assistance, and highlighted PDF documentation.
          </p>
          <div className="reveal-on-scroll delay-300">
            <a href={CHROME_STORE_URL} className="cta-button primary">
              Add to Chrome for Free
            </a>
          </div>
          
          <div className="hero-visual reveal-on-scroll delay-400">
            <video
              className="hero-video"
              src="/NexAura_Browser_Extension_Demo.mp4"
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
      </section>

      <section id="features" className="features">
        <div className="container">
          <h2 className="reveal-on-scroll">Built for modern, dynamic web applications.</h2>
          <p className="subheader reveal-on-scroll delay-100">Far beyond simple screen recording. NexAura understands the DOM.</p>
          
          <div className="feature-grid">
            <div className="feature-card reveal-on-scroll delay-100">
              <div className="icon">🎯</div>
              <h3>Human-in-the-Loop Playback</h3>
              <p>
                A true Copilot, not an autopilot. NexAura highlights the exact element you need to interact with, but waits for you to take the action. Perfect for secure onboarding and training.
              </p>
            </div>

            <div className="feature-card reveal-on-scroll delay-200">
              <div className="icon">👁️</div>
              <h3>Computer Vision Fallback</h3>
              <p>
                Websites change. If CSS classes break, our multi-tiered locator engine instantly falls back to visual screenshot matching to find the right button, ensuring guides never break.
              </p>
            </div>

            <div className="feature-card reveal-on-scroll delay-300">
              <div className="icon">🩹</div>
              <h3>Self-Healing Repair UX</h3>
              <p>
                If an element completely disappears, the guide doesn't just fail. Our Repair Overlay lets you manually select the new element, seamlessly updating the guide for everyone.
              </p>
            </div>

            <div className="feature-card reveal-on-scroll delay-100">
              <div className="icon">📄</div>
              <h3>Instant PDF Documentation</h3>
              <p>
                Every step you record is automatically compiled into a beautiful PDF document, complete with precision-drawn highlight boxes over the exact elements you clicked.
              </p>
            </div>

            <div className="feature-card reveal-on-scroll delay-200">
              <div className="icon">🧠</div>
              <h3>Context-Aware AI Chat</h3>
              <p>
                Stuck on a page? Ask the AI. NexAura takes a visual snapshot of your screen and provides answers based exactly on what you are looking at in the browser.
              </p>
            </div>

            <div className="feature-card reveal-on-scroll delay-300">
              <div className="icon">⚡</div>
              <h3>SPA & Iframe Ready</h3>
              <p>
                Engineered to survive complex Single Page Applications (like LinkedIn or GitHub) and cross-origin iframes without losing tracking or closing dynamic dropdowns.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="how-it-works">
        <div className="container">
          <h2 className="reveal-on-scroll">Record once. Train everyone.</h2>
          <div className="steps-grid">
            <div className="step-card reveal-on-scroll delay-100">
              <span>1</span>
              <h3>Capture</h3>
              <p>
                Hit record and click through your workflow. NexAura silently captures deep DOM selectors, ARIA labels, and visual bounds.
              </p>
            </div>

            <div className="step-card reveal-on-scroll delay-200">
              <span>2</span>
              <h3>Contextualize</h3>
              <p>
                Add simple instructions to your steps (e.g., "Click here to view your network"). Save the guide to your library with a quick shortcut.
              </p>
            </div>

            <div className="step-card reveal-on-scroll delay-300">
              <span>3</span>
              <h3>Guide</h3>
              <p>
                Run the guide anytime. NexAura projects highlight boxes directly onto the live webpage, leading you step-by-step to the finish line.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer reveal-on-scroll">
        <div className="container">
          <p>&copy; {new Date().getFullYear()} NexAura. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;