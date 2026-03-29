import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? ` (${this.props.label})` : ""}]`, error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center p-8 gap-4 border border-red-900/30 bg-red-950/10 rounded-sm">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <div className="text-center">
            <p className="text-sm font-semibold text-red-400">
              {this.props.label ? `${this.props.label} crashed` : "Something went wrong"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {this.state.error?.message ?? "Unknown error"}
            </p>
          </div>
          <button
            onClick={this.reset}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
