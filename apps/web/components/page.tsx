"use client";

import { Empty, Flex, Spin, Typography } from "antd";

export function PageHeading({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-heading"><div><Typography.Title level={2}>{title}</Typography.Title><Typography.Text type="secondary">{description}</Typography.Text></div>{action}</div>;
}
export function QueryState({ loading, error, empty, children }: { loading: boolean; error?: Error | null; empty?: boolean; children: React.ReactNode }) {
  if (loading) return <Flex justify="center" style={{ padding: 80 }}><Spin size="large" /></Flex>;
  if (error) return <Empty description={error.message} />;
  if (empty) return <Empty description="No records yet" />;
  return children;
}
