import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can log the error to an error reporting service here
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 shadow-lg max-w-md w-full">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-600 mb-4">🚫 Something went wrong</h1>
              <p className="text-gray-600 mb-4">
                The application encountered an error. Please refresh the page or contact support.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="bg-pink-500 hover:bg-pink-600 text-white px-6 py-3 rounded-lg"
              >
                Refresh Page
              </button>
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500">Technical Details</summary>
                  <pre className="text-xs text-red-600 mt-2 overflow-auto">
                    {this.state.error && this.state.error.toString()}
                    <br />
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
