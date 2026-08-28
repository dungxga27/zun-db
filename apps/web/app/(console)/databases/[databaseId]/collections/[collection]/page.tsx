import { CollectionExplorer } from "@/components/collection-explorer";
export default async function CollectionPage({ params }: { params: Promise<{ databaseId: string; collection: string }> }) { const { databaseId, collection } = await params; return <CollectionExplorer databaseId={databaseId} collection={decodeURIComponent(collection)} />; }
