import { DetailSection } from "../../../../components/detail/DetailSection";

interface SlashCommandTextProps {
  description?: string | null;
  prompt?: string | null;
  descriptionEmptyText?: string;
  promptEmptyText?: string;
}

export function SlashCommandContentSections({
  description,
  prompt,
  descriptionEmptyText,
  promptEmptyText,
}: SlashCommandTextProps) {
  return (
    <>
      <DetailSection heading="Description">
        <SlashCommandDescriptionBlock
          description={description}
          emptyText={descriptionEmptyText}
        />
      </DetailSection>
      <DetailSection heading="Prompt">
        <SlashCommandPromptPreview
          prompt={prompt}
          emptyText={promptEmptyText}
        />
      </DetailSection>
    </>
  );
}

export function SlashCommandSourcePreview({
  description,
  prompt,
  descriptionEmptyText,
  promptEmptyText,
}: SlashCommandTextProps) {
  return (
    <div className="slash-command-detail__content-preview">
      <div className="slash-command-detail__content-field">
        <span>Description</span>
        <SlashCommandDescriptionBlock
          description={description}
          emptyText={descriptionEmptyText}
        />
      </div>
      <div className="slash-command-detail__content-field">
        <span>Prompt</span>
        <SlashCommandPromptPreview
          prompt={prompt}
          emptyText={promptEmptyText}
        />
      </div>
    </div>
  );
}

export function SlashCommandDescriptionBlock({
  description,
  emptyText = "No description provided.",
}: {
  description?: string | null;
  emptyText?: string;
}) {
  return (
    <div className="slash-command-detail__description-block">
      <p className="slash-command-detail__description-text">
        {description?.trim() || emptyText}
      </p>
    </div>
  );
}

export function SlashCommandPromptPreview({
  prompt,
  emptyText = "No prompt content.",
}: {
  prompt?: string | null;
  emptyText?: string;
}) {
  return (
    <pre className="slash-command-detail__prompt ui-scrollbar">
      {prompt?.trim() || emptyText}
    </pre>
  );
}
