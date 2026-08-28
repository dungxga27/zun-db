"use client";

import { PageHeading, QueryState } from "@/components/page";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Card, Input, Table, Typography } from "antd";
import { useDeferredValue, useState } from "react";

type Log = { _id: string; createdAt: string; actorId?: string; action: string; target?: string; details?: Record<string, unknown> };

export default function AuditPage() {
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search.toLowerCase());
  const query = useQuery({ queryKey: ["audit"], queryFn: () => api<Log[]>("/audit?limit=500") });
  const data = query.data?.filter((row) => [row.actorId, row.action, row.target, JSON.stringify(row.details)].some((value) => value?.toLowerCase().includes(deferred)));
  return <><PageHeading title="Audit logs" description="Recorded security and infrastructure events." action={<Input.Search allowClear placeholder="Actor, action, or target" value={search} onChange={(event) => setSearch(event.target.value)} style={{ width: 280 }} />} /><QueryState loading={query.isLoading} error={query.error} empty={!data?.length}><Card><Table rowKey="_id" dataSource={data} scroll={{ x: 900 }} columns={[{ title: "Time", dataIndex: "createdAt", render: (value) => new Date(value).toLocaleString() }, { title: "Actor ID", dataIndex: "actorId", render: (value) => value || "System" }, { title: "Action", dataIndex: "action" }, { title: "Target", dataIndex: "target", render: (value) => value || "-" }, { title: "Details", dataIndex: "details", render: (value) => <Typography.Text code>{value ? JSON.stringify(value) : "-"}</Typography.Text> }]} /></Card></QueryState></>;
}
