"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] gap-4 p-6 rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <p className="text-red-700 dark:text-red-300 font-medium">
            Error al cargar este módulo
          </p>
          <p className="text-sm text-red-500 dark:text-red-400">
            {this.state.message}
          </p>
          <button
            className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700"
            onClick={() => this.setState({ hasError: false, message: "" })}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
