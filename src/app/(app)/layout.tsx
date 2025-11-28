import { LayoutProvider } from "@/components/layout-provider";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LayoutProvider>{children}</LayoutProvider>;
}
