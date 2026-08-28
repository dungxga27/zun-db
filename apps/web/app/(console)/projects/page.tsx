"use client";

import { PageHeading, QueryState } from "@/components/page";
import { api, Project, ProjectCreateResult } from "@/lib/api";
import { PlusOutlined, ProjectOutlined, SyncOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Button, Card, Col, Form, Input, Modal, Row, Space, Typography } from "antd";
import Link from "next/link";
import { useState } from "react";

type CreateProject = { name: string; databaseName: string; databaseUser?: string; password?: string; description?: string };

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

export default function ProjectsPage() {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<ProjectCreateResult>();
  const [form] = Form.useForm<CreateProject>();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const query = useQuery({ queryKey: ["projects"], queryFn: () => api<Project[]>("/projects") });
  const create = useMutation({
    mutationFn: (values: CreateProject) => api<ProjectCreateResult>("/projects", { method: "POST", body: JSON.stringify(values) }),
    onSuccess: (result) => { qc.invalidateQueries({ queryKey: ["projects"] }); setOpen(false); setCreated(result); form.resetFields(); message.success("Project created"); },
  });
  const password = Form.useWatch("password", form);

  return <>
    <PageHeading title="Projects" description="MongoDB databases and their scoped application users." action={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Create project</Button>} />
    <QueryState loading={query.isLoading} error={query.error} empty={!query.data?.length}>
      <Row gutter={[16, 16]}>{query.data?.map((project) => <Col xs={24} md={12} xl={8} key={project._id}><Link href={`/projects/${project._id}`}><Card hoverable><Space direction="vertical" size="middle" style={{ width: "100%" }}><Space><ProjectOutlined style={{ color: "#1677ff", fontSize: 22 }} /><Typography.Title level={4} style={{ margin: 0 }}>{project.name}</Typography.Title></Space><Typography.Text type="secondary">{project.description || "No description"}</Typography.Text><Typography.Text code>{project.databaseName}</Typography.Text></Space></Card></Link></Col>)}</Row>
    </QueryState>
    <Modal title="Create project" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={create.isPending}>
      <Form form={form} layout="vertical" onFinish={(values) => create.mutate(values)}>
        <Form.Item name="name" label="Project name" rules={[{ required: true, message: "Enter a project name" }, { max: 100 }]}><Input placeholder="Payments production" addonAfter={<Button type="text" size="small" icon={<SyncOutlined />} onClick={() => { const names = randomNames(); form.setFieldsValue({ name: names.project, databaseName: names.database }); }}>Random</Button>} /></Form.Item>
        <Form.Item name="databaseName" label="Database name" rules={[{ required: true, message: "Enter a database name" }, { pattern: /^[A-Za-z_][A-Za-z0-9_-]*$/, message: "Use letters, numbers, underscores or hyphens" }]}><Input placeholder="payments_prod" addonAfter={<Button type="text" size="small" icon={<SyncOutlined />} onClick={() => form.setFieldValue("databaseName", randomNames().database)}>Random</Button>} /></Form.Item>
        <Form.Item name="databaseUser" label="Database user (optional)" rules={[{ pattern: /^[A-Za-z_][A-Za-z0-9_-]*$/ }]}><Input placeholder="Generated when omitted" addonAfter={<Button type="text" size="small" icon={<SyncOutlined />} onClick={() => form.setFieldValue("databaseUser", `zun_${randomValue(12)}`)}>Random</Button>} /></Form.Item>
        <Form.Item name="password" label="Password (optional)" rules={[{ min: 8, max: 256 }]}><Space.Compact block><Input.Password value={password} onChange={(event) => form.setFieldValue("password", event.target.value)} placeholder="Generated when omitted" /><Button icon={<SyncOutlined />} onClick={() => form.setFieldValue("password", randomValue(32))}>Random</Button></Space.Compact></Form.Item>
        <Form.Item name="description" label="Description"><Input.TextArea maxLength={500} showCount /></Form.Item>
      </Form>
    </Modal>
    <Modal title="Project connection URI" open={Boolean(created)} onCancel={() => setCreated(undefined)} footer={<Button type="primary" onClick={() => setCreated(undefined)}>I have stored it</Button>}>
      <Alert type="warning" showIcon message="This URI is shown only once" description="Store it in a secret manager before closing this dialog." />
      <Typography.Paragraph copyable className="code-block" style={{ marginTop: 16 }}>{created?.uri}</Typography.Paragraph>
    </Modal>
  </>;
}
