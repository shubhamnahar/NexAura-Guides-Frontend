// src/components/ChatWidget.js
import React, { useState } from "react";
import axios from "axios";
import "./ChatWidget.css";

export default function ChatWidget({ captureFrame }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input) return;

    const imageBase64 = captureFrame();
    if (!imageBase64) {
      alert("Screen not available for capture!");
      return;
    }

    const newMsg = { role: "user", text: input };
    setMessages((prev) => [...prev, newMsg]);
    setLoading(true);
    setInput("");

    try {
      const res = await axios.post("http://127.0.0.1:8000/api/analyze_live", 
        // 1st Parameter: The data payload
        {
          image_base64: imageBase64,
          question: input,
        },        
      );

      // Now Axios knows it's just text, so it won't crash! res.data will be your exact string.
      const botText = res.data || "No response received.";
      
      const reply = { role: "bot", text: botText };
      setMessages((prev) => [...prev, reply]);
      
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { role: "bot", text: "Error analyzing screen." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`chat-widget ${open ? "open" : ""}`}>
      <div className="chat-header" onClick={() => setOpen(!open)}>
        💬 Screen Copilot
      </div>

      {open && (
        <div className="chat-body">
          <div className="messages">
            {messages.map((msg, i) => (
              <div 
                key={i} 
                className={`msg ${msg.role}`}
                // 🆕 STYLE: "pre-wrap" ensures the \n from backend becomes a new line
                style={{ whiteSpace: "pre-wrap", lineHeight: "1.5" }}
              >
                {msg.text}
              </div>
            ))}
          </div>

          <form onSubmit={sendMessage} className="input-area">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask something about your screen..."
              disabled={loading}
            />
            <button type="submit" disabled={loading}>
              {loading ? "..." : "Send"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}