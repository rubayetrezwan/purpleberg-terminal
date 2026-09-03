import { Component } from "react";

// Class-based error boundary — React hooks can't catch render errors, so this is
// the only way to stop one broken screen from taking down the whole terminal.
// Usage in App.jsx:
//   <ErrorBoundary key={screen} screen={screen}>{renderScreen()}</ErrorBoundary>
// The `key={screen}` matters: changing screen unmounts the boundary so a prior
// error doesn't stick when the user navigates away.
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

  handleReset = () => {
    this.setState({ error: null, info: null });
  };

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;

    return (
      <div
        style={{
          padding: 24,
          margin: 16,
          background: "#1a0f1f",
          border: "1px solid #ff4466",
          borderRadius: 6,
          fontFamily: "'Segoe UI','Helvetica Neue',Arial,sans-serif",
          color: "#e6d5ff",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, color: "#ff6699", letterSpacing: 1, marginBottom: 8 }}>
          SCREEN ERROR {this.props.screen ? `— ${this.props.screen}` : ""}
        </div>
        <div style={{ fontSize: 12, color: "#e6d5ff", marginBottom: 12 }}>
          This panel crashed while rendering. The rest of the terminal is still usable — pick
          another function from the sidebar, or retry this one.
        </div>
        <div
          style={{
            fontSize: 11,
            fontFamily: "'JetBrains Mono',monospace",
            color: "#ff9bb3",
            background: "#0f0614",
            padding: 10,
            borderRadius: 4,
            border: "1px solid #4a1a33",
            overflow: "auto",
            maxHeight: 180,
            whiteSpace: "pre-wrap",
            marginBottom: 12,
          }}
        >
          {String(error?.message || error)}
          {isDev && info?.componentStack ? "\n" + info.componentStack : ""}
        </div>
        <button
          onClick={this.handleReset}
          style={{
            padding: "6px 14px",
            background: "#8b5cf6",
            color: "#fff",
            border: "none",
            borderRadius: 3,
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.5,
          }}
        >
          RETRY
        </button>
      </div>
    );
  }
}
