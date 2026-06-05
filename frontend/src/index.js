import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ color: '#fff', background: '#1a1a2e', minHeight: '100vh', padding: 24, fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: 13 }}>
          <b style={{ color: '#f66', fontSize: 16 }}>⚠ Error en la aplicación</b>{'\n\n'}
          {String(this.state.error)}{'\n\n'}
          {this.state.error?.stack}
        </div>
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
