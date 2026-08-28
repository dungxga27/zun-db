import { DatabaseDetail } from "@/components/database-detail";
export default async function DatabasePage({ params }: { params: Promise<{ databaseId: string }> }) { const { databaseId } = await params; return <DatabaseDetail id={databaseId} />; }
