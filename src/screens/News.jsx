import { useMemo, useState } from "react";
import { useRoute, updateQuery } from "../router/index.jsx";
import { useNewsFeed } from "../features/newsFeed.jsx";
import { Page } from "../ui/Grid.jsx";
import { Section } from "../ui/Section.jsx";
import { Input } from "../ui/Input.jsx";
import { Ticker } from "../ui/Ticker.jsx";
import { Tag } from "../ui/Tag.jsx";
import { Freshness } from "../ui/Freshness.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";

// Short local-timezone label, so the times below are unambiguous.
const LOCAL_TZ = (() => {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: "short" }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value || "local";
  } catch {
    return "local";
  }
})();

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

function Group({ title, items, offset }) {
  if (!items.length) return null;
  return (
    <Section title={title} meta={`${items.length}`} flush>
      <ol className="pb-newslist">
        {items.map((n, i) => (
          <li key={n.link || `${n.title}-${i}`} className="pb-newslist__row">
            <span className="pb-newslist__num pb-muted">{offset + i + 1})</span>
            <a className="pb-newslist__body" href={n.link} target="_blank" rel="noopener noreferrer">
              <span className="pb-newslist__meta pb-muted">
                {n.publishedAt
                  ? new Date(n.publishedAt * 1000).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
                  : "—"}
              </span>
              <span className="pb-newslist__title">{n.title}</span>
            </a>
            <span className="pb-news__tags">
              {n.publisher && <Tag>{n.publisher.slice(0, 18)}</Tag>}
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
  const { news, loading, updatedAt, intervalMs } = useNewsFeed();
  const [filter, setFilter] = useState(query.q || "");

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
        meta={<><span>{filtered.length} stories, times in {LOCAL_TZ}</span>{" · "}<Freshness updatedAt={updatedAt} intervalMs={intervalMs} /></>}
      >
        <Input
          value={filter}
          onChange={(e) => { setFilter(e.target.value); updateQuery({ q: e.target.value || null }); }}
          placeholder="FILTER BY KEYWORD, PUBLISHER, OR SYMBOL"
          aria-label="Filter news"
        />
        <div className="pb-form__hint pb-muted">
          The feed follows the first four symbols in your watchlist.
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
