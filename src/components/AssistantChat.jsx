import { useEffect, useRef, useState } from "react";

const STARTER = { role: "assistant", content: "Hi! I'm Boba Buddy 🧋 Ask me about our drinks, prices, or what to try!" };
const SUGGESTIONS = ["What drinks do you recommend?", "What's on the menu?", "What can you tell me about milk tea?"];

export default function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([STARTER]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const controllerRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, open]);
  useEffect(() => () => controllerRef.current?.abort(), []);

  async function send(text = draft) {
    const message = text.trim();
    if (!message || loading || message.length > 1200) return;
    const history = messages.slice(1).slice(-8);
    const sent = { role: "user", content: message };
    setMessages((previous) => [...previous, sent]);
    setDraft("");
    setError("");
    setLoading(true);
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const API_URL =
        import.meta.env.VITE_API_URL || "http://localhost:3001";

      const response = await fetch(`${API_URL}/api/assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to get a response.");
      if (typeof data.reply !== "string") throw new Error("Invalid response from assistant.");
      setMessages((previous) => [...previous, { role: "assistant", content: data.reply }]);
    } catch (err) {
      if (err.name !== "AbortError") setError(err.message || "Assistant unavailable.");
    } finally {
      setLoading(false);
      controllerRef.current = null;
    }
  }

  return (
    <div className="assistant-widget">
      {open && (
        <section className="assistant-panel" aria-label="Boba Buddy assistant">
          <header className="assistant-header">
            <div><strong>🧋 Boba Buddy</strong><span>Your Boba Bliss assistant</span></div>
            <button type="button" aria-label="Close chat" onClick={() => setOpen(false)}>×</button>
          </header>
          <div className="assistant-conversation" role="log" aria-live="polite" aria-relevant="additions text">
            {messages.map((item, index) => (
              <p key={index} className={`assistant-message assistant-message-${item.role}`}>{item.content}</p>
            ))}
            {messages.length === 1 && (
              <div className="assistant-suggestions">
                {SUGGESTIONS.map((text) => <button type="button" key={text} onClick={() => send(text)}>{text}</button>)}
              </div>
            )}
            {loading && <p className="assistant-message assistant-message-assistant">Thinking…</p>}
            {error && <p className="assistant-error" role="alert">{error}</p>}
            <div ref={bottomRef} />
          </div>
          <form className="assistant-compose" onSubmit={(event) => { event.preventDefault(); send(); }}>
            <label className="assistant-sr-only" htmlFor="assistant-input">Ask Boba Buddy a question</label>
            <input id="assistant-input" ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1200} placeholder="Ask about the menu…" disabled={loading} />
            <button type="submit" disabled={!draft.trim() || loading} aria-label="Send message">Send</button>
          </form>
          <p className="assistant-disclaimer">AI replies may be inaccurate. Confirm allergens and ingredients with staff. Don't share personal information.</p>
        </section>
      )}
      <button className="assistant-launcher" type="button" aria-expanded={open} aria-label={open ? "Close Boba Buddy chat" : "Open Boba Buddy chat"} onClick={() => setOpen((value) => !value)}>
        {open ? "×" : "🧋 Chat with Boba Buddy"}
      </button>
    </div>
  );
}
