"use client";

import { PageHeading, QueryState } from "@/components/page";
import { api, Project, ProjectCreateResult } from "@/lib/api";
import { PlusOutlined, SyncOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Button, Card, Form, Input, Modal, Space, Table, Typography } from "antd";
import Link from "next/link";
import { useState } from "react";

type CreateDatabase = { name: string; databaseName: string; databaseUser?: string; password?: string; description?: string };

function randomValue(length: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function randomNames() {
  const words = ["atlas", "nova", "orbit", "pulse", "vertex", "nimbus", "harbor", "stellar"];
  const name = `${words[Math.floor(Math.random() * words.length)]}-${randomValue(6).toLowerCase()}`;
  return { project: name.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" "), database: name.replaceAll("-", "_") };
}

export default function DatabasesPage() {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<ProjectCreateResult>();
  const [form] = Form.useForm<CreateDatabase>();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const query = useQuery({ queryKey: ["projects"], queryFn: () => api<Project[]>("/projects") });
  const create = useMutation({
    mutationFn: (values: CreateDatabase) => api<ProjectCreateResult>("/projects", { method: "POST", body: JSON.stringify(values) }),
    onSuccess: (result) => { queryClient.invalidateQueries({ queryKey: ["projects"] }); setOpen(false); setCreated(result); form.resetFields(); message.success("Database created"); },
  });
  const password = Form.useWatch("password", form);

  return <>
    <PageHeading title="Databases" description="MongoDB database inventory derived from managed projects." action={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Create database</Button>} />
    <QueryState loading={query.isLoading} error={query.error} empty={!query.data?.length}><Card><Table rowKey="_id" dataSource={query.data} columns={[{ title: "Database", dataIndex: "databaseName", render: (value, row) => <Link href={`/databases/${row._id}`}>{value}</Link> }, { title: "Project", dataIndex: "name", render: (value, row) => <Link href={`/projects/${row._id}`}>{value}</Link> }, { title: "Database user", dataIndex: "username", render: (value) => <Typography.Text code>{value}</Typography.Text> }, { title: "Created", dataIndex: "createdAt", render: (value) => new Date(value).toLocaleString() }]} /></Card></QueryState>
    <Modal title="Create database" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={create.isPending}>
      {create.error && <Alert type="error" showIcon message={create.error.message} style={{ marginBottom: 16 }} />}
      <Form form={form} layout="vertical" onFinish={(values) => create.mutate(values)}>
        <Form.Item name="name" label="Project name" rules={[{ required: true, message: "Enter a project name" }, { max: 100 }]}><Input placeholder="My Next.js app" addonAfter={<Button type="text" size="small" icon={<SyncOutlined />} onClick={() => { const names = randomNames(); form.setFieldsValue({ name: names.project, databaseName: names.database }); }}>Random</Button>} /></Form.Item>
        <Form.Item name="databaseName" label="Database name" rules={[{ required: true, message: "Enter a database name" }, { pattern: /^[A-Za-z_][A-Za-z0-9_-]*$/, message: "Use letters, numbers, underscores or hyphens" }]}><Input placeholder="my_next_app" addonAfter={<Button type="text" size="small" icon={<SyncOutlined />} onClick={() => form.setFieldValue("databaseName", randomNames().database)}>Random</Button>} /></Form.Item>
        <Form.Item name="databaseUser" label="Database user (optional)" rules={[{ pattern: /^[A-Za-z_][A-Za-z0-9_-]*$/ }]}><Input placeholder="Generated when omitted" addonAfter={<Button type="text" size="small" icon={<SyncOutlined />} onClick={() => form.setFieldValue("databaseUser", `zun_${randomValue(12)}`)}>Random</Button>} /></Form.Item>
        <Form.Item name="password" label="Password (optional)" rules={[{ min: 8, max: 256 }]}><Space.Compact block><Input.Password value={password} onChange={(event) => form.setFieldValue("password", event.target.value)} placeholder="Generated when omitted" /><Button icon={<SyncOutlined />} onClick={() => form.setFieldValue("password", randomValue(32))}>Random</Button></Space.Compact></Form.Item>
        <Form.Item name="description" label="Description"><Input.TextArea maxLength={500} showCount /></Form.Item>
      </Form>
    </Modal>
    <Modal title="Database connection URI" open={Boolean(created)} onCancel={() => setCreated(undefined)} footer={<Button type="primary" onClick={() => setCreated(undefined)}>I have stored it</Button>}>
      <Alert type="warning" showIcon message="This URI is shown only once" description="Copy it now and store it as MONGODB_URI in Vercel." />
      <Typography.Paragraph copyable className="code-block" style={{ marginTop: 16 }}>{created?.uri}</Typography.Paragraph>
    </Modal>
  </>;
}
