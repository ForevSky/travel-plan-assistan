import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "@/app/AppLayout";
import ErrorBoundary from "@/shared/components/ErrorBoundary";
import HomePage from "@/features/home/pages/Home";
import ChatPage from "@/features/chat/pages/Chat";
import SharePage from "@/features/share/pages/Share";

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#2563eb",
          colorSuccess: "#10b981",
          colorText: "#0f172a",
          colorTextSecondary: "#64748b",
          colorBorder: "#e2e8f0",
          colorBgLayout: "#f8fafc",
          borderRadius: 8,
          borderRadiusLG: 12,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
          boxShadow: "0 4px 16px rgba(15, 23, 42, 0.06)",
          boxShadowSecondary: "0 1px 2px rgba(15, 23, 42, 0.04)",
        },
        components: {
          Button: {
            controlHeight: 36,
            paddingContentHorizontal: 16,
          },
          Modal: {
            borderRadiusLG: 12,
          },
        },
      }}
    >
      <ErrorBoundary>
        <Routes>
          <Route path="/share/:token" element={<SharePage />} />
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/chat/:conversationId" element={<ChatPage />} />
          </Route>
          <Route path="/chat" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </ConfigProvider>
  );
}
