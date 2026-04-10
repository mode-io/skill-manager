import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownDocumentProps {
  markdown: string;
  className?: string;
}

export default function MarkdownDocument({
  markdown,
  className = "skill-detail__markdown",
}: MarkdownDocumentProps) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
