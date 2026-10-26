import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute, updateQuery } from "../router/index.jsx";
import { useNewsFeed } from "../features/newsFeed.jsx";
import { fmtNewsTime, LOCAL_TZ } from "../lib/format.js";
import { useIsMobile } from "../data/hooks.js";
import { Page } from "../ui/Grid.jsx";
import { Section } from "../ui/Section.jsx";
import { Input } from "../ui/Input.jsx";
import { Ticker } from "../ui/Ticker.jsx";
import { Tag } from "../ui/Tag.jsx";
import { Freshness } from "../ui/Freshness.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

function Group({ title, items, offset }) {
  if (!items.length) return null;
  return (
    <Section title={title} meta={`${items.length} STORIES`} flush>
      <ol className="pb-newslist">
        {items.map((n, i) => (
          <li key={n.link || `${n.title}-${i}`} className="pb-newslist__row">
            <span className="pb-newslist__num pb-muted">{offset + i + 1})</span>
            <a className="pb-newslist__body" href={n.link} target="_blank" rel="noopener noreferrer">
              <span className="pb-newslist__meta pb-muted">
                {fmtNewsTime(n.publishedAt)}
              </span>
              <span className="pb-newslist__title">{n.title}</span>
            </a>
            <span className="pb-news__tags">
              {n.publisher && <Tag><span className="pb-clip" style={{ "--clip": "18ch" }} title={n.publisher}>{n.publisher}</span></Tag>}
              {n.relatedSymbol && <Ticker symbol={n.relatedSymbol} star={false} />}
            </span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export default function News() {
  const { query } = useRoute();
  const { news, loading, updatedAt, intervalMs, symbols, fromWatchlist } = useNewsFeed();
  const isPhone = useIsMobile(768);
  // Seeded from the URL and kept in step with it, so Back and Forward across a
  // ?q= change move the input and the list together with the address bar.
  const [filter, setFilter] = useState(query.q || "");
  const lastQ = useRef(query.q || "");
  useEffect(() => {
    const q = query.q || "";
    if (q !== lastQ.current) { lastQ.current = q; setFilter(q); }
  }, [query.q]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return news || [];
    return (news || []).filter(
      (n) =>
        String(n.title || "").toLowerCase().includes(q) ||
        String(n.publisher || "").toLowerCase().includes(q) ||
        String(n.relatedSymbol || "").toLowerCase().includes(q)
    );
  }, [news, filter]);

  const { today, earlier } = useMemo(() => {
    const cutoff = startOfToday() / 1000;
    const t = [];
    const e = [];
    for (const n of filtered) (n.publishedAt >= cutoff ? t : e).push(n);
    return { today: t, earlier: e };
  }, [filtered]);

  return (
    <Page>
      <Section
        mnemonic="TOP"
        title="News"
        meta={<><span>{filtered.length} STORIES · TIMES {LOCAL_TZ}</span>{" · "}<Freshness updatedAt={updatedAt} intervalMs={intervalMs} /></>}
      >
        <Input
          value={filter}
          onChange={(e) => { lastQ.current = e.target.value; setFilter(e.target.value); updateQuery({ q: e.target.value || null }); }}
          // The long hint is wider than a phone-width field.
          placeholder={isPhone ? "KEYWORD, SOURCE, SYMBOL" : "FILTER BY KEYWORD, PUBLISHER, OR SYMBOL"}
          aria-label="Filter news"
          className="pb-news__filter"
          mono
        />
        <div className="pb-form__hint pb-muted pb-news__feed">
          FEED: {symbols.join(" ")} · {fromWatchlist ? "FIRST 4 WATCHLIST SYMBOLS" : "DEFAULT SET, WATCHLIST EMPTY"}
        </div>
      </Section>

      {loading && !filtered.length ? (
        <Section title="Loading"><EmptyState>LOADING NEWS…</EmptyState></Section>
      ) : !filtered.length ? (
        <Section title="No stories"><EmptyState>{filter ? "NO MATCH" : "NO HEADLINES"}</EmptyState></Section>
      ) : (
        <>
          <Group title="Today" items={today} offset={0} />
          <Group title="Earlier" items={earlier} offset={today.length} />
        </>
      )}
    </Page>
  );
}
