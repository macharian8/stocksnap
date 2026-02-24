import React from 'react';
import { View, Text } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ padding: 20 }}>
          <Text style={{ color: 'red', fontWeight: 'bold', marginBottom: 8 }}>
            Render error:
          </Text>
          <Text style={{ color: 'red' }}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}
