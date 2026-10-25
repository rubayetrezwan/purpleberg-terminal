import { Component } from "react";

// What browsers say when a code-split chunk cannot be loaded (Chrome, Safari,
// Firefox, and Vite's CSS preload). After a redeploy the tab still asks for
// the old build's chunk names, which no longer exist on the server.
const CHUNK_ERROR = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;

export function isChunkLoadError(error) {
  return CHUNK_ERROR.test(String((error && error.message) || error || ""));
}

const RELOAD_KEY = "pb:chunk-reload";
const RELOAD_GUARD_MS = 10_000;

// Reload the page to pick up the current build, unless that was just tried:
// if the fresh page fails the same way, reloading again would only loop.
// Returns false when the guard holds the reload back.
export function reloadForNewBuild() {
  let last = 0;
  try { last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0; } catch { /* storage blocked */ }
  if (Date.now() - last < RELOAD_GUARD_MS) return false;
  try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { /* storage blocked */ }
  window.location.reload();
  return true;
}

// Class-based error boundary — React hooks can't catch render errors, so this is
// the only way to stop one broken screen from taking down the whole terminal.
// Usage in App.jsx:
//   <ErrorBoundary key={screen} screen={screen} resetKey={path} onRetry={fn}>{renderScreen()}</ErrorBoundary>
// The `key={screen}` matters: changing screen unmounts the boundary so a prior
// error doesn't stick when the user navigates away. `resetKey` clears an error
// when the path changes within the same screen (a new symbol), without
// remounting a healthy screen on every symbol change.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the stack in state for the dev fallback; in prod we still console.error
    // so it's visible in browser dev tools.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", this.props.screen || "", error, info);
    this.setState({ info });
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null, info: null });
    }
  }

  handleReset = () => {
    // A chunk that failed to load fails again on a plain re-render, since
    // React.lazy keeps the rejected import. Reloading fetches the current
    // build; if the guard holds that back, ask the screens to import again.
    if (isChunkLoadError(this.state.error) && reloadForNewBuild()) return;
    if (this.props.onRetry) this.props.onRetry();
    this.setState({ error: null, info: null });
  };

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
    const chunk = isChunkLoadError(error);

    return (
      <div className="pb-error" role="alert">
        <div className="pb-error__title">SCREEN ERROR{this.props.screen ? ` · ${this.props.screen}` : ""}</div>
        <div className="pb-error__msg">
          {chunk
            ? "This screen failed to load, usually because the terminal was updated after this tab opened. RETRY reloads the page."
            : "This screen crashed while rendering. The rest of the terminal still works: pick another function or retry this one."}
        </div>
        <div className="pb-error__stack">
          {String(error?.message || error)}
          {isDev && info?.componentStack ? "\n" + info.componentStack : ""}
        </div>
        <button type="button" className="pb-button pb-button--primary" onClick={this.handleReset}>RETRY</button>
      </div>
    );
  }
}
