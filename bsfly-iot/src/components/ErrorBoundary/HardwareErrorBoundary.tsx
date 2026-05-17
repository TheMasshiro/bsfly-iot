import React from "react";
import { IonAlert } from "@ionic/react";

export interface ErrorInfo {
  title: string;
  message: string;
  code?: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    const errorInfo = parseError(error);
    return {
      hasError: true,
      error: errorInfo,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Hardware Error:", error, errorInfo);
    if (this.props.onError) {
      this.props.onError(parseError(error));
    }
  }

  handleDismiss = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <>
          {this.props.children}
          <IonAlert
            isOpen={true}
            onDidDismiss={this.handleDismiss}
            header={this.state.error.title}
            message={this.state.error.message}
            buttons={["OK"]}
            color="danger"
          />
        </>
      );
    }

    return this.props.children;
  }
}

export function parseError(error: any): ErrorInfo {
  if (error?.code === "ECONNABORTED") {
    return {
      title: "Connection Timeout",
      message: "Device is not responding. Check if it's connected to WiFi.",
      code: "TIMEOUT",
    };
  }

  if (error?.response?.status === 503 || error?.response?.status === 504) {
    return {
      title: "Device Offline",
      message: "The device is currently unreachable. Try rebooting or check WiFi connection.",
      code: "DEVICE_OFFLINE",
    };
  }

  if (error?.response?.status === 401) {
    return {
      title: "Authentication Failed",
      message: "Your session has expired. Please log in again.",
      code: "AUTH_FAILED",
    };
  }

  if (error?.response?.status === 403) {
    return {
      title: "Access Denied",
      message: "You don't have permission to control this device.",
      code: "FORBIDDEN",
    };
  }

  if (error?.response?.status === 404) {
    return {
      title: "Device Not Found",
      message:
        "The device configuration is missing. Contact support if this persists.",
      code: "NOT_FOUND",
    };
  }

  if (error?.response?.status >= 500) {
    return {
      title: "Server Error",
      message: "The backend service is experiencing issues. Try again later.",
      code: `HTTP_${error.response.status}`,
    };
  }

  if (error?.message === "Network Error" || !error?.response) {
    return {
      title: "Network Error",
      message:
        "Check your internet connection and ensure the device is accessible.",
      code: "NETWORK_ERROR",
    };
  }

  return {
    title: "Operation Failed",
    message: error?.message || error?.response?.data?.error || "An unexpected error occurred.",
    code: error?.response?.status?.toString(),
  };
}

export default ErrorBoundary;
