import { useState } from "react";
import { FileText } from "lucide-react";
import { useColors } from "../ThemeContext";
import { Panel, PanelHeader, Badge, LoadingSpinner } from "../shared";

export default function NewsCenter({ news, loading }) {
  const COLORS = useColors();
  const [searchFilter, setSearchFilter] = useState("");

  const allNews = news || [];
  const filtered = searchFilter
    ? allNews.filter(
        (n) =>
          (n.title || "").toLowerCase().includes(searchFilter.toLowerCase()) ||
          (n.publisher || "").toLowerCase().includes(searchFilter.toLowerCase()) ||
          (n.relatedSymbol || "").toLowerCase().includes(searchFilter.toLowerCase())
      )
    : allNews;

  return (
    <div style={{ padding: 12 }}>
      <Panel>
        <PanelHeader
          icon={<FileText size={14} color={COLORS.gold} />}
          title="NEWS CENTER"
          subtitle="Real-time market news from Yahoo Finance"
          right={<Badge>{filtered.length} stories</Badge>}
        />

        <div style={{ padding: "6px 10px", display: "flex", gap: 8, borderBottom: `1px solid ${COLORS.border}`, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: COLORS.textMuted }}>SEARCH:</span>
          <input
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter by keyword, publisher, or symbol..."
            style={{
              flex: 1, padding: "4px 10px", background: COLORS.bgInput,
              border: `1px solid ${COLORS.border}`, borderRadius: 4,
              color: COLORS.text, fontSize: 11, outline: "none",
            }}
          />
        </div>

        {loading ? (
          <LoadingSpinner text="Fetching latest news..." />
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.textMuted, fontSize: 12 }}>
            No news articles found.
          </div>
        ) : (
          filtered.map((n, i) => (
            <a
              key={i}
              href={n.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block", padding: "10px 14px",
                borderBottom: `1px solid ${COLORS.border}22`,
                cursor: "pointer", textDecoration: "none",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = COLORS.bgPanel)}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                {n.publishedAt && (
                  <span style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: "'JetBrains Mono',monospace", minWidth: 60 }}>
                    {new Date(n.publishedAt * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                  </span>
                )}
                {n.publisher && <Badge color={COLORS.blue}>{n.publisher.slice(0, 20)}</Badge>}
                {n.relatedSymbol && <Badge color={COLORS.green}>{n.relatedSymbol}</Badge>}
              </div>
              <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 500, lineHeight: 1.4 }}>{n.title}</div>
              {n.publishedAt && (
                <div style={{ fontSize: 9, color: COLORS.textMuted, marginTop: 4 }}>
                  {new Date(n.publishedAt * 1000).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                </div>
              )}
            </a>
          ))
        )}
      </Panel>
    </div>
  );
}
