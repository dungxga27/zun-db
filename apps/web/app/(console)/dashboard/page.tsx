"use client";

import { PageHeading, QueryState } from "@/components/page";
import { api, Project } from "@/lib/api";
import { AreaChartOutlined, ArrowRightOutlined, CheckCircleFilled, DatabaseOutlined, HddOutlined, ProjectOutlined, ReloadOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Column } from "@ant-design/charts";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Card, Col, Progress, Row, Space, Table, Tag, Tooltip, Typography } from "antd";
import Link from "next/link";

type Overview = {
  system: { cpuLoadPercent: number; memory: { total: number; used: number; available: number }; disks: { mount: string; size: number; used: number; usePercent: number }[] };
  mongodb: { version: string; uptimeSeconds: number; connections: { current: number; available: number }; opcounters: Record<string, number>; network: Record<string, number> };
};

const gb = (bytes: number) => bytes / 1024 / 1024 / 1024;
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function SummaryCard({ title, value, note, icon, tone }: { title: string; value: number | string; note: string; icon: React.ReactNode; tone: string }) {
  return <Card className="summary-card" bordered={false}>
    <div className="flex items-start justify-between gap-4">
      <div><Typography.Text className="summary-label" type="secondary">{title}</Typography.Text><div className="summary-value">{value}</div></div>
      <span className={`summary-icon ${tone}`}>{icon}</span>
    </div>
    <Typography.Text className="summary-note" type="secondary">{note}</Typography.Text>
  </Card>;
}

function Resource({ name, percent, detail, color }: { name: string; percent: number; detail: string; color: string }) {
  return <div className="resource-row">
    <div className="flex items-center justify-between gap-4"><Typography.Text strong>{name}</Typography.Text><Typography.Text strong>{percent}%</Typography.Text></div>
    <Progress percent={percent} showInfo={false} strokeColor={color} trailColor="rgba(128,128,128,.12)" />
    <Typography.Text type="secondary">{detail}</Typography.Text>
  </div>;
}

export default function DashboardPage() {
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [overview, projects] = await Promise.all([api<Overview>("/monitoring"), api<Project[]>("/projects")]);
      return { overview, projects };
    },
    refetchInterval: 30_000,
  });

  return <>
    <PageHeading
      title="Dashboard"
      description="A real-time view of your MongoDB infrastructure."
      action={<Space><Badge status="success" text="Systems operational" /><Button icon={<ReloadOutlined />} loading={query.isFetching} onClick={() => query.refetch()}>Refresh</Button></Space>}
    />
    <QueryState loading={query.isLoading} error={query.error}>{query.data && (() => {
      const { overview, projects } = query.data;
      const memoryPercent = Math.round(overview.system.memory.used / overview.system.memory.total * 100);
      const disk = overview.system.disks[0];
      const diskPercent = Math.round(disk?.usePercent || 0);
      const uptimeDays = Math.floor(overview.mongodb.uptimeSeconds / 86400);
      const uptimeHours = Math.floor(overview.mongodb.uptimeSeconds / 3600);
      const operations = Object.entries(overview.mongodb.opcounters)
        .filter(([, value]) => typeof value === "number")
        .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

      return <div className="dashboard-grid">
        <Card className="system-overview" bordered={false}>
          <div className="system-overview-main">
            <div className="flex min-w-0 items-start gap-4">
              <span className="system-status-icon"><CheckCircleFilled /></span>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2"><Typography.Title level={3}>MongoDB cluster is healthy</Typography.Title><Tag color="success" bordered={false}>ONLINE</Tag></div>
                <Typography.Text type="secondary">Version {overview.mongodb.version} · Up for {uptimeDays > 0 ? `${uptimeDays} days` : `${uptimeHours} hours`} · All checks passing</Typography.Text>
              </div>
            </div>
            <Link href="/monitoring"><Button>Open monitoring <ArrowRightOutlined /></Button></Link>
          </div>
          <div className="system-overview-stats">
            <div><Typography.Text type="secondary">Current connections</Typography.Text><strong>{overview.mongodb.connections.current}</strong></div>
            <div><Typography.Text type="secondary">Available capacity</Typography.Text><strong>{compact.format(overview.mongodb.connections.available)}</strong></div>
            <div><Typography.Text type="secondary">Managed databases</Typography.Text><strong>{projects.length}</strong></div>
          </div>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} xl={6}><SummaryCard title="PROJECTS" value={projects.length} note="Provisioned workspaces" icon={<ProjectOutlined />} tone="blue" /></Col>
          <Col xs={24} sm={12} xl={6}><SummaryCard title="DATABASES" value={projects.length} note="Isolated MongoDB instances" icon={<DatabaseOutlined />} tone="violet" /></Col>
          <Col xs={24} sm={12} xl={6}><SummaryCard title="CONNECTIONS" value={overview.mongodb.connections.current} note={`${compact.format(overview.mongodb.connections.available)} available`} icon={<SafetyCertificateOutlined />} tone="cyan" /></Col>
          <Col xs={24} sm={12} xl={6}><SummaryCard title="STORAGE USED" value={`${diskPercent}%`} note={disk ? `${gb(disk.used).toFixed(1)} of ${gb(disk.size).toFixed(1)} GB` : "No disk information"} icon={<HddOutlined />} tone="amber" /></Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={16}>
            <Card className="dashboard-card operations-card" bordered={false} title={<div><Typography.Text strong>Database operations</Typography.Text><Typography.Text className="panel-subtitle" type="secondary">Cumulative commands since the last MongoDB restart</Typography.Text></div>} extra={<AreaChartOutlined />}>
              {operations.length > 0 && <Column height={300} data={operations} xField="name" yField="value" color="#3b82f6" legend={false} style={{ radiusTopLeft: 4, radiusTopRight: 4 }} axis={{ x: { title: false }, y: { title: false, labelFormatter: (value: number) => compact.format(value) } }} />}
            </Card>
          </Col>
          <Col xs={24} xl={8}>
            <Card className="dashboard-card resources-card" bordered={false} title={<div><Typography.Text strong>Server resources</Typography.Text><Typography.Text className="panel-subtitle" type="secondary">Current host utilization</Typography.Text></div>} extra={<Link href="/monitoring">Details</Link>}>
              <Resource name="CPU load" percent={Math.round(overview.system.cpuLoadPercent)} detail={`${overview.system.cpuLoadPercent.toFixed(1)}% processing load`} color="#3b82f6" />
              <Resource name="Memory" percent={memoryPercent} detail={`${gb(overview.system.memory.used).toFixed(1)} GB of ${gb(overview.system.memory.total).toFixed(1)} GB`} color="#8b5cf6" />
              <Resource name="Disk" percent={diskPercent} detail={disk ? `${gb(disk.size - disk.used).toFixed(1)} GB free on ${disk.mount}` : "No disk information"} color="#f59e0b" />
            </Card>
          </Col>
        </Row>

        <Card className="dashboard-card databases-card" bordered={false} title={<div><Typography.Text strong>Managed databases</Typography.Text><Typography.Text className="panel-subtitle" type="secondary">Projects and database access at a glance</Typography.Text></div>} extra={<Link href="/projects">View all <ArrowRightOutlined /></Link>}>
          <Table scroll={{ x: 760 }} rowKey="_id" pagination={false} dataSource={projects.slice(0, 6)} locale={{ emptyText: "No projects yet" }} columns={[
            { title: "PROJECT", dataIndex: "name", render: (value, row) => <Space><span className="database-avatar"><DatabaseOutlined /></span><div className="table-primary"><Link href={`/projects/${row._id}`}>{value}</Link><Typography.Text type="secondary">{row.description || "MongoDB project"}</Typography.Text></div></Space> },
            { title: "DATABASE", dataIndex: "databaseName", render: (value, row) => <Link href={`/databases/${row._id}`}><Typography.Text code>{value}</Typography.Text></Link> },
            { title: "USER", dataIndex: "username", render: (value) => <Typography.Text code>{value}</Typography.Text> },
            { title: "STATUS", render: () => <Space size={6}><Badge status="success" /><Typography.Text>Active</Typography.Text></Space> },
            { title: "CREATED", dataIndex: "createdAt", render: (value) => <Tooltip title={new Date(value).toLocaleString()}>{new Date(value).toLocaleDateString()}</Tooltip> },
          ]} />
        </Card>
      </div>;
    })()}</QueryState>
  </>;
}
