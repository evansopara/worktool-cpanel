import ProjectDetailClient from './ProjectDetailClient';

export async function generateStaticParams() {
  return [{ id: '0' }];
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <ProjectDetailClient params={params} />;
}
