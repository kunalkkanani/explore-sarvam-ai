import { Component } from "react";
import VoiceAssistant from "./components/VoiceAssistant";

class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(err) {
    return { error: err };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-red-500 font-medium">Something went wrong</p>
            <p className="text-slate-400 text-sm mt-1">
              {this.state.error.message}
            </p>
            <button
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
        <VoiceAssistant />
      </div>
    </ErrorBoundary>
  );
}
