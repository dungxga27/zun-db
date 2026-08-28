"use client";

import { api, ApiError, User } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApartmentOutlined, AuditOutlined, BellOutlined, CloudServerOutlined, DashboardOutlined, DatabaseOutlined, HistoryOutlined, MenuFoldOutlined, MenuOutlined, MonitorOutlined, MoonOutlined, ProjectOutlined, SearchOutlined, SettingOutlined, SunOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
import { Avatar, Badge, Button, Card, Divider, Drawer, Dropdown, Grid, Input, Layout, Menu, Result, Segmented, Skeleton, Space, Tag, theme, Tooltip, Typography } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { ThemeMode, useThemeMode } from "./providers";

const { Header, Sider, Content } = Layout;
const routes = [
  { key: "/dashboard", label: "Dashboard" }, { key: "/projects", label: "Projects" },
  { key: "/databases", label: "Databases" }, { key: "/mongodb", label: "MongoDB" },
  { key: "/monitoring", label: "Monitoring" }, { key: "/backups", label: "Backups" },
  { key: "/audit-logs", label: "Audit Logs" }, { key: "/admin/users", label: "Admin Users" },
  { key: "/settings", label: "Settings" },
];
const nav = [
  { key: "/dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
  { type: "group" as const, label: "INFRASTRUCTURE", children: [
    { key: "/projects", icon: <ProjectOutlined />, label: "Projects" },
    { key: "/databases", icon: <DatabaseOutlined />, label: "Databases" },
    { key: "/mongodb", icon: <CloudServerOutlined />, label: "MongoDB" },
    { key: "/monitoring", icon: <MonitorOutlined />, label: "Monitoring" },
  ] },
  { type: "group" as const, label: "OPERATIONS", children: [
    { key: "/backups", icon: <HistoryOutlined />, label: "Backups" },
    { key: "/audit-logs", icon: <AuditOutlined />, label: "Audit Logs" },
  ] },
  { type: "group" as const, label: "ADMINISTRATION", children: [
    { key: "/admin/users", icon: <TeamOutlined />, label: "Admin Users" },
    { key: "/settings", icon: <SettingOutlined />, label: "Settings" },
  ] },
];

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { mode, setMode } = useThemeMode();
  const { token } = theme.useToken();
  const user = useQuery({ queryKey: ["me"], queryFn: () => api<User>("/auth/me"), retry: false });

  if (user.isLoading) return <Layout className="workspace-loading" style={{ background: token.colorBgLayout }}>
    <aside className="workspace-loading-sider"><div className="brand"><span className="brand-mark"><ApartmentOutlined /></span><span className="brand-copy">ZunDB <small>CONTROL PLANE</small></span></div><Skeleton active title={false} paragraph={{ rows: 8, width: ["82%", "68%", "88%", "72%", "84%", "62%", "78%", "70%"] }} /></aside>
    <Layout style={{ background: token.colorBgLayout }}><header className="workspace-loading-header" style={{ background: token.colorBgContainer }}><Skeleton.Button active size="small" /><Skeleton.Input active size="small" /></header><main className="workspace-loading-main"><Skeleton active paragraph={{ rows: 2 }} /><div className="workspace-loading-grid"><Card><Skeleton active paragraph={{ rows: 2 }} /></Card><Card><Skeleton active paragraph={{ rows: 2 }} /></Card><Card><Skeleton active paragraph={{ rows: 2 }} /></Card></div><Card><Skeleton active paragraph={{ rows: 7 }} /></Card></main></Layout>
  </Layout>;
  if (user.error instanceof ApiError && user.error.status === 401) {
    router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    return null;
  }
  if (user.isError) return <Result status="500" title="Unable to load your workspace" subTitle={user.error.message} extra={<Button onClick={() => user.refetch()}>Try again</Button>} />;

  const currentRoute = routes.find((item) => pathname.startsWith(item.key));
  const menu = <Menu theme="dark" mode="inline" selectedKeys={[currentRoute?.key || pathname]} items={nav} onClick={({ key }) => { router.push(key); setDrawer(false); }} />;
  const brand = <div className="brand"><span className="brand-mark"><ApartmentOutlined /></span>{!collapsed && <span className="brand-copy">ZunDB <small>CONTROL PLANE</small></span>}</div>;
  const logout = async () => { await api("/auth/logout", { method: "POST" }); queryClient.clear(); router.replace("/login"); };
  const search = (value: string) => {
    const match = routes.find((item) => item.label.toLowerCase().includes(value.trim().toLowerCase()));
    if (match) router.push(match.key);
  };
  const sidebar = <div className="sidebar-inner">{brand}{menu}<div className="sidebar-footer"><Badge status="success" /><div><Typography.Text className="sidebar-status">MongoDB online</Typography.Text><Typography.Text className="sidebar-meta">Local instance</Typography.Text></div></div></div>;

  return (
    <Layout className="app-shell">
      {screens.md ? <Sider className="app-sider" width={264} collapsedWidth={80} theme="dark" collapsed={collapsed} trigger={null}>{sidebar}</Sider> : <Drawer className="nav-drawer" styles={{ body: { padding: 0, background: "#081426" } }} width={280} placement="left" open={drawer} onClose={() => setDrawer(false)}>{sidebar}</Drawer>}
      <Layout>
        <Header className="app-header" style={{ background: token.colorBgContainer }}>
          <Space size="middle" className="header-leading">
            <Button type="text" icon={screens.md ? <MenuFoldOutlined rotate={collapsed ? 180 : 0} /> : <MenuOutlined />} onClick={() => screens.md ? setCollapsed(!collapsed) : setDrawer(true)} />
            <div className="header-title"><Typography.Text strong>{currentRoute?.label || "Control plane"}</Typography.Text><Typography.Text type="secondary">Infrastructure / {currentRoute?.label || "Console"}</Typography.Text></div>
          </Space>
          {screens.lg && <Input className="header-search" prefix={<SearchOutlined />} allowClear placeholder="Search resources..." onPressEnter={(event) => search(event.currentTarget.value)} />}
          <Space size="small">
            <Tag className="server-tag" bordered={false}><Badge status="success" /> Server healthy</Tag>
            <Segmented className="theme-control" size="small" value={mode} onChange={(value) => setMode(value as ThemeMode)} options={[{ value: "light", icon: <SunOutlined /> }, { value: "dark", icon: <MoonOutlined /> }, { value: "system", label: "Auto" }]} />
            <Tooltip title="Notifications"><Badge dot offset={[-5, 5]}><Button type="text" shape="circle" icon={<BellOutlined />} /></Badge></Tooltip>
            <Divider type="vertical" className="header-divider" />
            <Dropdown menu={{ items: [{ key: "settings", label: "Account settings", onClick: () => router.push("/settings") }, { type: "divider" }, { key: "logout", label: "Sign out", danger: true, onClick: logout }] }}>
              <Button type="text" className="profile-button"><Avatar className="profile-avatar" icon={<UserOutlined />} />{screens.sm && <span className="profile-copy"><strong>{user.data?.email.split("@")[0]}</strong><small>{user.data?.role}</small></span>}</Button>
            </Dropdown>
          </Space>
        </Header>
        <Content><main className="app-content">{children}</main></Content>
      </Layout>
    </Layout>
  );
}
