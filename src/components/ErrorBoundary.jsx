import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-white text-center p-10 font-bold text-2xl">
          Something went wrong rendering the game.
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
