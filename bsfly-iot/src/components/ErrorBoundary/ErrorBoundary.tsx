import { Component, ReactNode } from 'react';
import ErrorFallback from './ErrorFallback';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
