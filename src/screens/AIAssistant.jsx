import { useState, useRef, useEffect } from "react";
import { Brain, User, Send, AlertTriangle } from "lucide-react";
import { useColors } from "../ThemeContext";
import { api } from "../api";
import { Panel, PanelHeader, Badge } from "../shared";

export default function AIAssistant() {
  const COLORS = useColors();
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Welcome to ASKB — Purpleberg's AI Research Assistant powered by Claude.\n\nI can help you analyze securities, research companies, screen markets, and answer financial questions.\n\nTry asking me about any company, market trend, or investment thesis.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);
    setApiError(null);

    try {
      // Build conversation history for context
      const chatMessages = [
        ...messages
          .filter((m) => m.role !== "system")
          .slice(-10) // Last 10 messages for context
          .map((m) => ({ role: m.role, content: m.text })),
        { role: "user", content: userMsg },
      ];

      const data = await api.chat(chatMessages);

      if (data.error) {
        if (data.message?.includes("ANTHROPIC_API_KEY")) {
          setApiError("API key not configured");
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              text: "⚠️ The AI assistant requires an Anthropic API key.\n\nTo set it up:\n1. Create a `.env` file in the project root\n2. Add: ANTHROPIC_API_KEY=your_key_here\n3. Get a key at: https://console.anthropic.com/\n4. Restart the server\n\nThe rest of the terminal works without it!",
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: `Error: ${data.error}` },
          ]);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: data.text },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Connection error. Make sure the backend server is running on port 3001.",
        },
      ]);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 12, height: "calc(100% - 24px)", display: "flex", flexDirection: "column" }}>
      <Panel style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <PanelHeader
          icon={<Brain size={14} color={COLORS.purple} />}
          title="ASKB — AI RESEARCH ASSISTANT"
          subtitle="Powered by Claude • Ask anything about markets"
          right={
            apiError ? (
              <Badge color={COLORS.orange}>SETUP NEEDED</Badge>
            ) : (
              <Badge color={COLORS.green}>ONLINE</Badge>
            )
          }
        />

        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 12, display: "flex", gap: 10 }}>
              <div
                style={{
                  width: 28, height: 28, borderRadius: 14,
                  background: m.role === "assistant" ? COLORS.purpleDim : COLORS.bgPanel,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, marginTop: 2,
                }}
              >
                {m.role === "assistant" ? (
                  <Brain size={14} color={COLORS.purpleLight} />
                ) : (
                  <User size={14} color={COLORS.textDim} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 10, fontWeight: 600,
                    color: m.role === "assistant" ? COLORS.purpleLight : COLORS.textDim,
                    marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5,
                  }}
                >
                  {m.role === "assistant" ? "ASKB" : "YOU"}
                </div>
                <div style={{ fontSize: 12, color: COLORS.text, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {m.text}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <div
                style={{
                  width: 28, height: 28, borderRadius: 14,
                  background: COLORS.purpleDim,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Brain size={14} color={COLORS.purpleLight} />
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, padding: "8px 0" }}>
                <span style={{ animation: "pulse 1.5s infinite" }}>Analyzing...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: 12, borderTop: `1px solid ${COLORS.border}`, display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Ask ASKB anything about markets, companies, or financial analysis..."
            style={{
              flex: 1, padding: "10px 14px", background: COLORS.bgInput,
              border: `1px solid ${COLORS.border}`, borderRadius: 6,
              color: COLORS.text, fontSize: 13, outline: "none",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            style={{
              padding: "10px 20px",
              background: loading ? COLORS.textMuted : COLORS.purple,
              border: "none", borderRadius: 6, color: COLORS.white,
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 6,
              fontWeight: 600, fontSize: 12,
            }}
          >
            <Send size={14} /> Ask
          </button>
        </div>
      </Panel>
    </div>
  );
}
