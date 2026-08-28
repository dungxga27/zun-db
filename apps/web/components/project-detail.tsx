"use client";

import { api, Project } from "@/lib/api";
import { DeleteOutlined, KeyOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Button, Card, Checkbox, Descriptions, Form, Input, Modal, Space, Typography } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeading, QueryState } from "./page";

export function ProjectDetail({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [uri, setUri] = useState<string>();
  const [deleting, setDeleting] = useState(false);
  const [form] = Form.useForm<{ databaseName: string; dropDatabase: boolean }>();
  const query = useQuery({ queryKey: ["project", id], queryFn: () => api<Project>(`/projects/${id}`) });
  const rotate = useMutation({ mutationFn: () => api<{ uri: string }>(`/projects/${id}/rotate-credentials`, { method: "POST" }), onSuccess: (result) => setUri(result.uri) });
  const remove = useMutation({
    mutationFn: (values: { databaseName: string; dropDatabase: boolean }) => api(`/projects/${id}`, { method: "DELETE", body: JSON.stringify(values) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); message.success("Project deleted"); router.replace("/projects"); },
  });
  const project = query.data;

  return <QueryState loading={query.isLoading} error={query.error}>{project && <>
    <PageHeading title={project.name} description={project.description || "Project database and scoped MongoDB user."} action={<Space><Button icon={<KeyOutlined />} loading={rotate.isPending} onClick={() => rotate.mutate()}>Rotate credentials</Button><Button danger icon={<DeleteOutlined />} onClick={() => { form.setFieldsValue({ databaseName: "", dropDatabase: false }); setDeleting(true); }}>Delete</Button></Space>} />
    <Card title="Project details"><Descriptions column={{ xs: 1, md: 2 }} items={[{ key: "id", label: "Project ID", children: project._id }, { key: "database", label: "Database", children: <Link href={`/databases/${project._id}`}>{project.databaseName}</Link> }, { key: "user", label: "Database user", children: project.username }, { key: "created", label: "Created", children: new Date(project.createdAt).toLocaleString() }]} /></Card>
    <Modal title="New connection URI" open={Boolean(uri)} onCancel={() => setUri(undefined)} footer={<Button type="primary" onClick={() => setUri(undefined)}>I have stored it</Button>}><Alert type="warning" showIcon message="This URI is shown only once" /><Typography.Paragraph copyable className="code-block" style={{ marginTop: 16 }}>{uri}</Typography.Paragraph></Modal>
    <Modal title="Delete project" open={deleting} onCancel={() => setDeleting(false)} onOk={() => form.submit()} okText="Delete project" okButtonProps={{ danger: true }} confirmLoading={remove.isPending}>
      <Alert type="warning" showIcon message="The project MongoDB user will be removed" description="Dropping the database is optional and permanently deletes all of its data." />
      <Form form={form} layout="vertical" onFinish={(values) => remove.mutate(values)} style={{ marginTop: 16 }}>
        <Form.Item name="databaseName" label={<>Type <Typography.Text code>{project.databaseName}</Typography.Text> to confirm</>} rules={[{ required: true }, { validator: (_, value) => value === project.databaseName ? Promise.resolve() : Promise.reject(new Error("Database name does not match")) }]}><Input autoComplete="off" /></Form.Item>
        <Form.Item name="dropDatabase" valuePropName="checked"><Checkbox>Also permanently drop database {project.databaseName}</Checkbox></Form.Item>
      </Form>
    </Modal>
  </>}</QueryState>;
}
