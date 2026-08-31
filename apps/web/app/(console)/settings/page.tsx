"use client";

import { PageHeading, QueryState } from "@/components/page";
import { ThemeMode, useThemeMode } from "@/components/providers";
import { api } from "@/lib/api";
import { CheckCircleFilled, CloudDownloadOutlined, GithubOutlined, PlusOutlined, SettingOutlined, SyncOutlined, WarningFilled } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Segmented, Space, Table, Tag, Typography } from "antd";
import { useEffect, useRef, useState } from "react";

type Setting = { _id: string; key: string; value: unknown; updatedAt: string };
type UpdateStatus = {
  state: "idle" | "running" | "completed" | "failed";
  message: string;
  updatedAt?: string;
  log: string;
  version: { current: string | null; latest: string | null; updateAvailable: boolean; repositoryUrl: string; checkedAt: string; error?: string };
};

const shortCommit = (commit: string | null | undefined) => commit?.slice(0, 7) || "unknown";

export default function SettingsPage() {
  const { mode, setMode } = useThemeMode();
  const [open, setOpen] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);
  const [form] = Form.useForm<{ key: string; value: string }>();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const query = useQuery({ queryKey: ["settings"], queryFn: () => api<Setting[]>("/settings") });
  const update = useQuery({ queryKey: ["platform-update"], queryFn: () => api<UpdateStatus>("/settings/platform-update"), refetchInterval: (current) => current.state.data?.state === "running" ? 2_000 : false, refetchIntervalInBackground: true });
  const save = useMutation({ mutationFn: ({ key, value }: { key: string; value: string }) => { let parsed: unknown; try { parsed = JSON.parse(value); } catch { parsed = value; } return api("/settings", { method: "PUT", body: JSON.stringify({ key, value: parsed }) }); }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings"] }); setOpen(false); form.resetFields(); message.success("Setting saved"); } });
  const startUpdate = useMutation({ mutationFn: () => api("/settings/platform-update", { method: "POST" }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["platform-update"] }); message.success("Platform update started"); } });
  const status = update.data;
  const isRunning = status?.state === "running";
  const hasUpdate = status?.version.updateAvailable;

  useEffect(() => {
    if (isRunning && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [isRunning, status?.log]);

  return <>
    <PageHeading title="Settings" description="Manage platform preferences, configuration, and software releases." action={<Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>New setting</Button>} />
    <div className="flex flex-col gap-4">
      <Card className={`release-card ${hasUpdate ? "release-card-update" : ""}`} bordered={false}>
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <span className="release-icon"><GithubOutlined /></span>
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Typography.Title level={3}>Platform release</Typography.Title>
                {update.isLoading ? <Tag icon={<SyncOutlined spin />}>Checking GitHub</Tag> : hasUpdate ? <Tag color="warning" icon={<WarningFilled />}>UPDATE AVAILABLE</Tag> : <Tag color="success" icon={<CheckCircleFilled />}>UP TO DATE</Tag>}
              </div>
              <Typography.Paragraph type="secondary" className="mb-0! max-w-2xl">The server compares its deployed commit with the latest commit on GitHub. Updates are built safely and rolled back automatically if health checks fail.</Typography.Paragraph>
              <div className="mt-4 flex flex-wrap gap-x-7 gap-y-2 text-sm">
                <span><Typography.Text type="secondary">Installed </Typography.Text><Typography.Text code>{shortCommit(status?.version.current)}</Typography.Text></span>
                <span><Typography.Text type="secondary">GitHub </Typography.Text><Typography.Text code>{shortCommit(status?.version.latest)}</Typography.Text></span>
                {status?.updatedAt && <span><Typography.Text type="secondary">Last deployment </Typography.Text><Typography.Text>{new Date(status.updatedAt).toLocaleString()}</Typography.Text></span>}
              </div>
            </div>
          </div>
          <div className="flex min-w-56 flex-col gap-2">
            <Popconfirm title="Deploy the latest release?" description="Web and API services restart briefly after the build succeeds." okText="Deploy update" onConfirm={() => startUpdate.mutate()} disabled={!hasUpdate || isRunning}>
              <Button size="large" type={hasUpdate ? "primary" : "default"} icon={isRunning ? <SyncOutlined spin /> : <CloudDownloadOutlined />} loading={startUpdate.isPending} disabled={!hasUpdate || isRunning}>{isRunning ? "Deploying update" : hasUpdate ? "Install latest version" : "Latest version installed"}</Button>
            </Popconfirm>
            {status?.version.repositoryUrl && <Button type="link" icon={<GithubOutlined />} href={status.version.repositoryUrl} target="_blank">View repository</Button>}
          </div>
        </div>
        {status?.version.error && <Alert className="mt-4" type="warning" showIcon message={status.version.error} />}
        {update.error && <Alert className="mt-4" type="error" showIcon message={update.error.message} />}
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <QueryState loading={query.isLoading} error={query.error}>
            <Card className="settings-panel" bordered={false} title={<Space><SettingOutlined /> Application settings</Space>} extra={<Typography.Text type="secondary">{query.data?.length || 0} values</Typography.Text>}>
              <Table scroll={{ x: 640 }} pagination={false} rowKey="_id" dataSource={query.data} locale={{ emptyText: "No custom application settings" }} columns={[
                { title: "KEY", dataIndex: "key", render: (value) => <Typography.Text strong>{value}</Typography.Text> },
                { title: "VALUE", dataIndex: "value", render: (value) => <Typography.Text code ellipsis>{JSON.stringify(value)}</Typography.Text> },
                { title: "UPDATED", dataIndex: "updatedAt", render: (value) => <Typography.Text type="secondary">{new Date(value).toLocaleString()}</Typography.Text> },
                { title: "", align: "right", render: (_, row) => <Button type="link" onClick={() => { form.setFieldsValue({ key: row.key, value: typeof row.value === "string" ? row.value : JSON.stringify(row.value, null, 2) }); setOpen(true); }}>Edit</Button> },
              ]} />
            </Card>
          </QueryState>
        </Col>
        <Col xs={24} lg={8}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Card className="settings-panel" bordered={false} title="Appearance">
              <Typography.Paragraph type="secondary">Choose how the console looks on this device.</Typography.Paragraph>
              <Segmented block value={mode} onChange={(value) => setMode(value as ThemeMode)} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "System" }]} />
            </Card>
            <Card className="settings-panel" bordered={false} title="Deployment status" extra={<Tag color={isRunning ? "processing" : status?.state === "failed" ? "error" : "success"}>{status?.state || "loading"}</Tag>}>
              <Typography.Paragraph type="secondary">{status?.message || "Checking updater status..."}</Typography.Paragraph>
              <Button block icon={<SyncOutlined />} onClick={() => update.refetch()} loading={update.isFetching}>Check GitHub now</Button>
            </Card>
          </Space>
        </Col>
        <Col span={24}>
          <Card className="settings-panel" bordered={false} title={<Space>Deployment log {isRunning && <Tag color="processing" icon={<SyncOutlined spin />}>LIVE</Tag>}</Space>} extra={<Space><Typography.Text type="secondary">{isRunning ? "Refreshing every 2 seconds" : "Last 30 KB"}</Typography.Text><Button size="small" icon={<SyncOutlined />} onClick={() => update.refetch()} loading={update.isFetching && !isRunning}>Refresh</Button></Space>}>
            <pre ref={logRef} className="update-log">{status?.log || "No update log yet."}</pre>
          </Card>
        </Col>
      </Row>
    </div>
    <Modal title="Set application value" open={open} onCancel={() => { setOpen(false); form.resetFields(); }} onOk={() => form.submit()} confirmLoading={save.isPending} okText="Save value"><Form form={form} layout="vertical" onFinish={(values) => save.mutate(values)}><Form.Item name="key" label="Key" rules={[{ required: true, pattern: /^[a-z][a-z0-9_.-]{0,63}$/ }]}><Input placeholder="feature.example" /></Form.Item><Form.Item name="value" label="Value" extra="JSON is stored as its native type; other input is stored as text." rules={[{ required: true }]}><Input.TextArea rows={6} placeholder='{"enabled": true}' /></Form.Item></Form></Modal>
  </>;
}
