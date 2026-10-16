import { Title } from "react-head";
import { Compass } from "lucide-react";
import { ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/Card";

export default function NotFound() {
  return (
    <>
      <Title>Not found · MediPharm</Title>
      <EmptyState
        icon={<Compass />}
        title="Page not found"
        description="The page you're looking for doesn't exist or was moved."
        action={<ButtonLink to="/">Back to dashboard</ButtonLink>}
        className="min-h-[60vh]"
      />
    </>
  );
}
