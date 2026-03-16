import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { ts } from "../config";
import { useColors } from "../ThemeContext";
import { useIsMobile } from "../hooks";
import { Panel, PanelHeader } from "../shared";

const CONTACTS = ["Trading Desk", "Research", "Risk", "PM", "Compliance", "Sales", "Quant Team", "Operations"];

export default function Messaging() {
  const COLORS = useColors();
  const isMobile = useIsMobile(768);
  const [showContacts, setShowContacts] = useState(!isMobile);
  const [messages, setMessages] = useState([
    { from: "System", time: "\u2014", text: "Welcome to Purpleberg IB Chat. This is a local demo \u2014 messages are not sent externally.", color: "purple" },
  ]);
  const [input, setInput] = useState("");
  const [activeContact, setActiveContact] = useState("Trading Desk");

  const sendMsg = () => {
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      { from: "You", time: ts().slice(0, 5), text: input, color: "purpleLight" },
    ]);
    setInput("");
  };

  return (
    <div style={{ padding: isMobile ? 8 : 12, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "200px 1fr", gap: 10, height: "calc(100% - 24px)" }}>
      {(!isMobile || showContacts) && (
      <Panel>
        <PanelHeader icon={<MessageSquare size={14} color={COLORS.purple} />} title="CONTACTS" />
        {CONTACTS.map((c) => (
          <div
            key={c}
            onClick={() => { setActiveContact(c); if (isMobile) setShowContacts(false); }}
            style={{
              padding: "8px 12px",
              borderBottom: `1px solid ${COLORS.border}22`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: activeContact === c ? COLORS.purpleDim + "44" : "transparent",
              borderLeft: activeContact === c ? `3px solid ${COLORS.purple}` : "3px solid transparent",
            }}
            onMouseOver={(e) => { if (activeContact !== c) e.currentTarget.style.background = COLORS.bgPanel; }}
            onMouseOut={(e) => { if (activeContact !== c) e.currentTarget.style.background = "transparent"; }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 4, background: COLORS.green }} />
            <span style={{ fontSize: 11, color: COLORS.text }}>{c}</span>
          </div>
        ))}
      </Panel>
      )}

      {(!isMobile || !showContacts) && (
      <Panel style={{ display: "flex", flexDirection: "column" }}>
        <PanelHeader
          icon={<MessageSquare size={14} color={COLORS.green} />}
          title={`CHAT — ${activeContact}`}
          subtitle={isMobile ? undefined : "Local demo messaging"}
          right={isMobile ? <span onClick={() => setShowContacts(true)} style={{ fontSize: 10, color: COLORS.purpleLight, cursor: "pointer" }}>Contacts</span> : undefined}
        />
        <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: COLORS[m.color] || m.color }}>{m.from}</span>
                <span style={{ fontSize: 9, color: COLORS.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>{m.time}</span>
              </div>
              <div
                style={{
                  fontSize: 12, color: COLORS.text, lineHeight: 1.4,
                  padding: "6px 10px", background: COLORS.bgPanel,
                  borderRadius: 4, borderLeft: `2px solid ${COLORS[m.color] || m.color}`,
                }}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: 10, borderTop: `1px solid ${COLORS.border}`, display: "flex", gap: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMsg()}
            placeholder="Type a message..."
            style={{
              flex: 1, padding: "8px 12px", background: COLORS.bgInput,
              border: `1px solid ${COLORS.border}`, borderRadius: 4,
              color: COLORS.text, fontSize: 12, outline: "none",
            }}
          />
          <button
            onClick={sendMsg}
            style={{
              padding: "8px 16px", background: COLORS.purple, border: "none",
              borderRadius: 4, color: COLORS.white, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4, fontSize: 12,
            }}
          >
            <Send size={14} /> Send
          </button>
        </div>
      </Panel>
      )}
    </div>
  );
}
