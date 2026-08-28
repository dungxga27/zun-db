"use client";

import { PageHeading, QueryState } from "@/components/page";
import { ThemeMode, useThemeMode } from "@/components/providers";
import { api } from "@/lib/api";
import { PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Col, Form, Input, Modal, Row, Select, Table, Typography } from "antd";
import { useState } from "react";

type Setting = { _id: string; key: string; value: unknown; updatedAt: string };

export default function SettingsPage() {
  const { mode, setMode } = useThemeMode();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<{ key: string; value: string }>();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const query = useQuery({ queryKey: ["settings"], queryFn: () => api<Setting[]>("/settings") });
  const save = useMutation({ mutationFn: ({ key, value }: { key: string; value: string }) => { let parsed: unknown; try { parsed = JSON.parse(value); } catch { parsed = value; } return api("/settings", { method: "PUT", body: JSON.stringify({ key, value: parsed }) }); }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings"] }); setOpen(false); form.resetFields(); message.success("Setting saved"); } });
  return <><PageHeading title="Settings" description="Persisted application key/value settings and local console appearance." action={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Set value</Button>} /><Row gutter={[16, 16]}><Col xs={24} lg={16}><QueryState loading={query.isLoading} error={query.error}><Card title="Application settings"><Table rowKey="_id" dataSource={query.data} columns={[{ title: "Key", dataIndex: "key" }, { title: "Value", dataIndex: "value", render: (value) => <Typography.Text code>{JSON.stringify(value)}</Typography.Text> }, { title: "Updated", dataIndex: "updatedAt", render: (value) => new Date(value).toLocaleString() }, { title: "", render: (_, row) => <Button type="link" onClick={() => { form.setFieldsValue({ key: row.key, value: typeof row.value === "string" ? row.value : JSON.stringify(row.value, null, 2) }); setOpen(true); }}>Edit</Button> }]} /></Card></QueryState></Col><Col xs={24} lg={8}><Card title="Appearance"><Select style={{ width: "100%" }} value={mode} onChange={(value: ThemeMode) => setMode(value)} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "Use system setting" }]} /></Card></Col></Row><Modal title="Set application value" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={save.isPending}><Form form={form} layout="vertical" onFinish={(values) => save.mutate(values)}><Form.Item name="key" label="Key" rules={[{ required: true, pattern: /^[a-z][a-z0-9_.-]{0,63}$/ }]}><Input /></Form.Item><Form.Item name="value" label="Value" extra="JSON is stored as its native type; other input is stored as text." rules={[{ required: true }]}><Input.TextArea rows={6} /></Form.Item></Form></Modal></>;
}
