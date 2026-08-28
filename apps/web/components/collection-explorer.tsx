"use client";

import { PageHeading, QueryState } from "./page";
import { api } from "@/lib/api";
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { App, Button, Card, Descriptions, Drawer, Empty, Form, Input, Popconfirm, Space, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useDeferredValue, useState } from "react";

type Doc = { _id: string; [key: string]: unknown };

function valueType(value: unknown) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function CompactValue({ value }: { value: unknown }) {
  if (value === null) return <Typography.Text type="secondary">null</Typography.Text>;
  if (typeof value === "boolean") return <Tag color={value ? "green" : "default"}>{String(value)}</Tag>;
  if (typeof value === "number") return <Typography.Text className="mongo-number">{value}</Typography.Text>;
  if (typeof value === "object") {
    const text = JSON.stringify(value);
    return <Tooltip title={<pre className="mongo-tooltip">{JSON.stringify(value, null, 2)}</pre>}><Typography.Text className="mongo-object">{Array.isArray(value) ? `Array(${value.length})` : text}</Typography.Text></Tooltip>;
  }
  return <Tooltip title={String(value)}><Typography.Text ellipsis className="mongo-string">{String(value)}</Typography.Text></Tooltip>;
}

export function CollectionExplorer({ databaseId, collection }: { databaseId: string; collection: string }) {
  const path = `/projects/${databaseId}/database/collections/${encodeURIComponent(collection)}/documents`;
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.toLowerCase());
  const [editing, setEditing] = useState<Doc | null | undefined>(undefined);
  const [viewing, setViewing] = useState<Doc>();
  const [form] = Form.useForm<{ value: string }>();
  const query = useQuery({ queryKey: ["documents", databaseId, collection], queryFn: () => api<Doc[]>(`${path}?limit=100`) });
  const documents = (query.data || []).filter((document) => !deferredSearch || JSON.stringify(document).toLowerCase().includes(deferredSearch));
  const fields = Array.from(new Set((query.data || []).flatMap((document) => Object.keys(document))));

  const save = useMutation({
    mutationFn: ({ value, id }: { value: string; id?: string }) => {
      const document = JSON.parse(value) as unknown;
      if (!document || Array.isArray(document) || typeof document !== "object") throw new Error("Document must be a JSON object");
      return api(id ? `${path}/${encodeURIComponent(id)}` : path, { method: id ? "PUT" : "POST", body: JSON.stringify({ document }) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["documents", databaseId, collection] }); setEditing(undefined); form.resetFields(); message.success("Document saved"); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`${path}/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["documents", databaseId, collection] }); message.success("Document deleted"); },
  });
  const openEditor = (document: Doc | null) => { setViewing(undefined); setEditing(document); form.setFieldValue("value", JSON.stringify(document || {}, null, 2)); };

  const columns: ColumnsType<Doc> = fields.map((field) => ({
    title: <Space size={5}><span>{field}</span><Typography.Text className="mongo-field-type">{valueType((query.data || []).find((document) => document[field] !== undefined)?.[field])}</Typography.Text></Space>,
    dataIndex: field,
    key: field,
    width: field === "_id" ? 230 : 180,
    ellipsis: true,
    fixed: field === "_id" ? "left" : undefined,
    render: (value: unknown) => <CompactValue value={value} />,
  }));
  columns.push({
    title: "Actions", key: "actions", width: 128, fixed: "right",
    render: (_, row) => <Space size={2}>
      <Tooltip title="View"><Button aria-label="View document" type="text" icon={<EyeOutlined />} onClick={() => setViewing(row)} /></Tooltip>
      <Tooltip title="Edit"><Button aria-label="Edit document" type="text" icon={<EditOutlined />} onClick={() => openEditor(row)} /></Tooltip>
      <Popconfirm title="Delete this document?" description="This cannot be undone." okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => remove.mutate(String(row._id))}><Tooltip title="Delete"><Button aria-label="Delete document" danger type="text" icon={<DeleteOutlined />} /></Tooltip></Popconfirm>
    </Space>,
  });

  return <>
    <PageHeading title={collection} description={`${query.data?.length || 0} documents · ${fields.length} fields · limited to 100 results`} action={<Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor(null)}>Insert document</Button>} />
    <QueryState loading={query.isLoading} error={query.error}>
      <Card className="mongo-explorer" bordered={false}>
        <div className="mongo-toolbar">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} allowClear prefix={<SearchOutlined />} placeholder="Search loaded documents" />
          <Space><Tag bordered={false}>{documents.length} rows</Tag><Button icon={<ReloadOutlined />} loading={query.isFetching} onClick={() => query.refetch()}>Refresh</Button></Space>
        </div>
        <Table<Doc> className="mongo-table" size="small" bordered rowKey={(row) => String(row._id)} dataSource={documents} columns={columns} scroll={{ x: Math.max(900, fields.length * 180 + 128), y: "calc(100vh - 360px)" }} sticky pagination={{ pageSize: 25, showSizeChanger: true, pageSizeOptions: [10, 25, 50, 100], showTotal: (total) => `${total} documents` }} onRow={(row) => ({ onDoubleClick: () => openEditor(row) })} locale={{ emptyText: <Empty description={search ? "No matching documents" : "No documents in this collection"} /> }} />
      </Card>
    </QueryState>

    <Drawer width={620} title={<Space><EyeOutlined /> Document details</Space>} open={Boolean(viewing)} onClose={() => setViewing(undefined)} extra={<Button type="primary" icon={<EditOutlined />} onClick={() => viewing && openEditor(viewing)}>Edit</Button>}>
      {viewing && <Descriptions className="mongo-descriptions" bordered size="small" column={1} items={Object.entries(viewing).map(([field, value]) => ({ key: field, label: <Space>{field}<Tag bordered={false}>{valueType(value)}</Tag></Space>, children: <CompactValue value={value} /> }))} />}
    </Drawer>

    <Drawer width={680} title={editing ? "Edit document" : "Insert document"} open={editing !== undefined} onClose={() => { setEditing(undefined); save.reset(); }} extra={<Space><Button onClick={() => setEditing(undefined)}>Cancel</Button><Button type="primary" loading={save.isPending} onClick={() => form.submit()}>Save document</Button></Space>}>
      <Typography.Paragraph type="secondary">Edit the document as JSON. The `_id` field is preserved by MongoDB when updating.</Typography.Paragraph>
      <Form form={form} layout="vertical" onFinish={({ value }) => save.mutate({ value, id: editing?._id ? String(editing._id) : undefined })}>
        <Form.Item name="value" label="Document JSON" validateStatus={save.isError ? "error" : undefined} help={save.error?.message} rules={[{ required: true }]}><Input.TextArea className="mongo-json-editor" autoSize={{ minRows: 20 }} spellCheck={false} /></Form.Item>
      </Form>
    </Drawer>
  </>;
}
