import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Result } from "antd";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI render error:", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="页面渲染出错"
          subTitle="请刷新页面后重试，若问题持续请联系管理员。"
          extra={
            <Button type="primary" onClick={this.handleRetry}>
              刷新页面
            </Button>
          }
        />
      );
    }

    return this.props.children;
  }
}
