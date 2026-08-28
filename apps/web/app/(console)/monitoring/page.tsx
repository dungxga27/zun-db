"use client";

import { PageHeading, QueryState } from "@/components/page";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Card, Col, Descriptions, Progress, Row, Statistic, Table } from "antd";

type Overview = { system: { cpuLoadPercent: number; memory: { total: number; used: number; available: number }; disks: { mount: string; size: number; used: number; usePercent: number }[] }; mongodb: { version: string; uptimeSeconds: number; connections: { current: number; available: number }; opcounters: Record<string, number>; network: Record<string, number> } };
const gb = (bytes: number) => (bytes / 1024 / 1024 / 1024).toFixed(1);

export default function MonitoringPage() {
  const query = useQuery({ queryKey: ["monitoring"], queryFn: () => api<Overview>("/monitoring"), refetchInterval: 30_000 });
  const data = query.data;
  return <><PageHeading title="Live monitoring" description="Current VPS and MongoDB server status, refreshed every 30 seconds." /><QueryState loading={query.isLoading} error={query.error}>{data && <Row gutter={[16, 16]}><Col xs={24} sm={12} lg={6}><Card><Statistic title="CPU load" value={data.system.cpuLoadPercent} precision={1} suffix="%" /></Card></Col><Col xs={24} sm={12} lg={6}><Card><Statistic title="Memory used" value={gb(data.system.memory.used)} suffix="GB" /></Card></Col><Col xs={24} sm={12} lg={6}><Card><Statistic title="Connections" value={data.mongodb.connections.current} /></Card></Col><Col xs={24} sm={12} lg={6}><Card><Statistic title="Uptime" value={Math.floor(data.mongodb.uptimeSeconds / 3600)} suffix="hours" /></Card></Col><Col xs={24} lg={12}><Card title="MongoDB"><Descriptions column={1} items={[{ key: "version", label: "Version", children: data.mongodb.version }, { key: "available", label: "Available connections", children: data.mongodb.connections.available }, { key: "operations", label: "Operations", children: Object.entries(data.mongodb.opcounters).map(([key, value]) => `${key}: ${value}`).join(", ") }]} /></Card></Col><Col xs={24} lg={12}><Card title="Memory"><Progress percent={Math.round(data.system.memory.used / data.system.memory.total * 100)} /><Descriptions column={1} items={[{ key: "total", label: "Total", children: `${gb(data.system.memory.total)} GB` }, { key: "available", label: "Available", children: `${gb(data.system.memory.available)} GB` }]} /></Card></Col><Col span={24}><Card title="Disks"><Table rowKey="mount" pagination={false} dataSource={data.system.disks} columns={[{ title: "Mount", dataIndex: "mount" }, { title: "Used", dataIndex: "used", render: (value) => `${gb(value)} GB` }, { title: "Size", dataIndex: "size", render: (value) => `${gb(value)} GB` }, { title: "Utilization", dataIndex: "usePercent", render: (value) => <Progress percent={Math.round(value)} size="small" /> }]} /></Card></Col></Row>}</QueryState></>;
}
