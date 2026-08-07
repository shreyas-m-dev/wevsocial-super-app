/**
 * MiniAppErrorBoundary — per-mini-app fault isolation.
 * 
 * FAULT ISOLATION: Each mini-app mounts inside its own ErrorBoundary.
 * If Sports crashes, this boundary catches the error and renders a fallback
 * UI, while Care and Events continue running in their own boundaries.
 * 
 * This is the React-level fault isolation. Combined with the bridge's
 * try/catch in event dispatch, a crashing mini-app cannot take down
 * the rest of the super-app.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  appId: string;
  appName: string;
  children: ReactNode;
  /** Called when the error boundary catches an error */
  onError?: (appId: string, error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class MiniAppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error for debugging
    console.error(
      `[MiniAppErrorBoundary] App '${this.props.appId}' crashed:`,
      error,
      errorInfo.componentStack
    );
    // Notify the host shell
    this.props.onError?.(this.props.appId, error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>{this.props.appName} encountered an error</Text>
          <Text style={styles.message}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
          <Text style={styles.hint}>
            Other apps are unaffected and continue to work normally.
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#1a1a2e',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e0e0e0',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#a0a0b0',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    color: '#707080',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
