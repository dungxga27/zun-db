"use client";

import { PageHeading, QueryState } from "@/components/page";
import { ThemeMode, useThemeMode } from "@/components/providers";
import { api } from "@/lib/api";
import { CloudDownloadOutlined, PlusOutlined, SyncOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Select, Space, Table, Tag, Typography } from "antd";
import { useState } from "react";

type Setting = { _id: string; key: string; value: unknown; updatedAt: string };
type UpdateStatus = { state: "idle" | "running" | "completed" | "failed"; message: string; updatedAt?: string; log: string };

export default function SettingsPage() {
  const { mode, setMode } = useThemeMode();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<{ key: string; value: string }>();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const query = useQuery({ queryKey: ["settings"], queryFn: () => api<Setting[]>("/settings") });
  const update = useQuery({ queryKey: ["platform-update"], queryFn: () => api<UpdateStatus>("/settings/platform-update"), refetchInterval: (current) => current.state.data?.state === "running" ? 3_000 : false });
  const save = useMutation({ mutationFn: ({ key, value }: { key: string; value: string }) => { let parsed: unknown; try { parsed = JSON.parse(value); } catch { parsed = value; } return api("/settings", { method: "PUT", body: JSON.stringify({ key, value: parsed }) }); }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings"] }); setOpen(false); form.resetFields(); message.success("Setting saved"); } });
  const startUpdate = useMutation({ mutationFn: () => api("/settings/platform-update", { method: "POST" }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-update"] }); message.success("Platform update started"); } });
  const updateColor = update.data?.state === "completed" ? "success" : update.data?.state === "failed" ? "error" : update.data?.state === "running" ? "processing" : "default";

  return <>
    <PageHeading title="Settings" description="Platform configuration, appearance, and software updates." action={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Set value</Button>} />
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={16}><QueryState loading={query.isLoading} error={query.error}><Card title="Application settings"><Table rowKey="_id" dataSource={query.data} columns={[{ title: "Key", dataIndex: "key" }, { title: "Value", dataIndex: "value", render: (value) => <Typography.Text code>{JSON.stringify(value)}</Typography.Text> }, { title: "Updated", dataIndex: "updatedAt", render: (value) => new Date(value).toLocaleString() }, { title: "", render: (_, row) => <Button type="link" onClick={() => { form.setFieldsValue({ key: row.key, value: typeof row.value === "string" ? row.value : JSON.stringify(row.value, null, 2) }); setOpen(true); }}>Edit</Button> }]} /></Card></QueryState></Col>
      <Col xs={24} lg={8}><Space direction="vertical" size={16} style={{ width: "100%" }}><Card title="Appearance"><Select style={{ width: "100%" }} value={mode} onChange={(value: ThemeMode) => setMode(value)} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "Use system setting" }]} /></Card><Card title="Platform update" extra={<Tag color={updateColor}>{update.data?.state || "loading"}</Tag>}><Typography.Paragraph type="secondary">Download, build, and deploy the latest release from GitHub. Services restart after a successful build.</Typography.Paragraph><Popconfirm title="Update MongoDB Platform?" description="The API and web services will restart briefly after the new release builds." okText="Start update" onConfirm={() => startUpdate.mutate()}><Button block type="primary" icon={update.data?.state === "running" ? <SyncOutlined spin /> : <CloudDownloadOutlined />} loading={startUpdate.isPending} disabled={update.data?.state === "running"}>{update.data?.state === "running" ? "Update in progress" : "Update platform"}</Button></Popconfirm>{update.error && <Alert type="error" showIcon message={update.error.message} style={{ marginTop: 12 }} />}</Card></Space></Col>
      <Col span={24}><Card title="Update log" extra={<Button icon={<SyncOutlined />} onClick={() => update.refetch()} loading={update.isFetching}>Refresh</Button>}><Typography.Paragraph type="secondary">{update.data?.message || "Loading updater status..."}</Typography.Paragraph><pre className="update-log">{update.data?.log || "No update log yet."}</pre></Card></Col>
    </Row>
    <Modal title="Set application value" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={save.isPending}><Form form={form} layout="vertical" onFinish={(values) => save.mutate(values)}><Form.Item name="key" label="Key" rules={[{ required: true, pattern: /^[a-z][a-z0-9_.-]{0,63}$/ }]}><Input /></Form.Item><Form.Item name="value" label="Value" extra="JSON is stored as its native type; other input is stored as text." rules={[{ required: true }]}><Input.TextArea rows={6} /></Form.Item></Form></Modal>
  </>;
}
