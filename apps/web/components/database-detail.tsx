"use client";

import { api, CollectionInfo, Project } from "@/lib/api";
import { PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Descriptions, Form, Input, Modal, Table, Tag } from "antd";
import Link from "next/link";
import { useState } from "react";
import { PageHeading, QueryState } from "./page";

export function DatabaseDetail({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<{ name: string }>();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const project = useQuery({ queryKey: ["project", id], queryFn: () => api<Project>(`/projects/${id}`) });
  const collections = useQuery({ queryKey: ["collections", id], queryFn: () => api<CollectionInfo[]>(`/projects/${id}/database/collections`) });
  const create = useMutation({ mutationFn: (values: { name: string }) => api(`/projects/${id}/database/collections`, { method: "POST", body: JSON.stringify(values) }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["collections", id] }); setOpen(false); form.resetFields(); message.success("Collection created"); } });
  const data = project.data;
  const error = project.error || collections.error;
  return <QueryState loading={project.isLoading || collections.isLoading} error={error}>{data && <>
    <PageHeading title={data.databaseName} description={`MongoDB database managed by project ${data.name}.`} action={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Create collection</Button>} />
    <Card title="Configuration" style={{ marginBottom: 16 }}><Descriptions column={{ xs: 1, md: 3 }} items={[{ key: "database", label: "Database name", children: data.databaseName }, { key: "project", label: "Project", children: <Link href={`/projects/${data._id}`}>{data.name}</Link> }, { key: "user", label: "Database user", children: data.username }]} /></Card>
    <Card title="Collections"><Table rowKey="name" dataSource={collections.data} columns={[{ title: "Collection", dataIndex: "name", render: (value) => <Link href={`/databases/${id}/collections/${encodeURIComponent(value)}`}>{value}</Link> }, { title: "Type", dataIndex: "type", render: (value) => <Tag>{value}</Tag> }]} /></Card>
    <Modal title="Create collection" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={create.isPending}><Form form={form} layout="vertical" onFinish={(values) => create.mutate(values)}><Form.Item name="name" label="Collection name" rules={[{ required: true, pattern: /^[A-Za-z_][A-Za-z0-9_-]*$/ }]}><Input /></Form.Item></Form></Modal>
  </>}</QueryState>;
}
