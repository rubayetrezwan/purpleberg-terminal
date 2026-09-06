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
      <div className="pb-error" role="alert">
        <div className="pb-error__title">SCREEN ERROR{this.props.screen ? ` · ${this.props.screen}` : ""}</div>
        <div className="pb-error__msg">
          This screen crashed while rendering. The rest of the terminal still works: pick another function or retry this one.
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
