import { Component, type ReactNode } from 'react';

interface Props {
  label: string;
  children: ReactNode;
}

/** One broken panel shouldn't take down the whole terminal. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[${this.props.label}]`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="panel empty" role="alert">
          <p>{this.props.label} failed to load.</p>
          <button className="link-btn" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
