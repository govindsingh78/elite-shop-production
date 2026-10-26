import React from "react";
import { reportError } from "./monitor";

/** If a page crashes, shows a friendly way out instead of a blank screen, and reports it to the admins. */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    // The component that crashed, from the first line of React's component stack ("at ProductPage (…)").
    const component = info?.componentStack?.trim().split("\n")[0]?.trim().replace(/^at /, "").split(" ")[0];
    reportError(error, { component });
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="app-crash" role="alert">
        <div>
          <h1>Something went wrong on this page</h1>
          <p>Sorry about that — our team has been told. Reloading usually fixes it.</p>
          <div className="app-crash-actions">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload the page</button>
            <a className="btn btn-outline-secondary" href="/">Go to the home page</a>
          </div>
        </div>
      </div>
    );
  }
}
