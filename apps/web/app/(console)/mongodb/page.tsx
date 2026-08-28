"use client";

import { PageHeading, QueryState } from "@/components/page";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Descriptions, Popconfirm, Space, Tag } from "antd";

type Status = { status: string; version: string; uptimeSeconds: number; connections: { current: number; available: number } };
type Action = "start" | "stop" | "restart";

export default function MongoPage() {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const query = useQuery({ queryKey: ["mongodb-status"], queryFn: () => api<Status>("/mongodb/service/status"), retry: false });
  const operation = useMutation({ mutationFn: (action: Action) => api(`/mongodb/service/${action}`, { method: "POST" }), onSuccess: (_, action) => { setTimeout(() => qc.invalidateQueries({ queryKey: ["mongodb-status"] }), 1000); message.success(`MongoDB ${action} command completed`); } });
  const status = query.data;
  return <><PageHeading title="MongoDB controls" description="Manage the configured MongoDB service on this VPS." /><QueryState loading={query.isLoading} error={query.error}>{status && <Card><Descriptions column={{ xs: 1, md: 2 }} items={[{ key: "status", label: "Status", children: <Tag color="green">{status.status}</Tag> }, { key: "version", label: "Version", children: status.version }, { key: "uptime", label: "Uptime", children: `${Math.floor(status.uptimeSeconds / 3600)} hours` }, { key: "connections", label: "Connections", children: `${status.connections.current} current / ${status.connections.available} available` }]} /><Space wrap style={{ marginTop: 24 }}><Popconfirm title="Start MongoDB service?" onConfirm={() => operation.mutate("start")}><Button loading={operation.isPending}>Start</Button></Popconfirm><Popconfirm title="Stop MongoDB service?" description="Applications will lose database access." onConfirm={() => operation.mutate("stop")}><Button danger loading={operation.isPending}>Stop</Button></Popconfirm><Popconfirm title="Restart MongoDB service?" description="Connections will be interrupted." onConfirm={() => operation.mutate("restart")}><Button type="primary" loading={operation.isPending}>Restart</Button></Popconfirm></Space></Card>}</QueryState></>;
}
