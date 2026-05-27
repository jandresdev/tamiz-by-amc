'use client';

interface AnswerButtonProps {
  label: string;
  description?: string;
  selected?: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export default function AnswerButton({
  label,
  description,
  selected = false,
  onClick,
  disabled = false,
}: AnswerButtonProps) {
  return (
    <button
      type="button"
      className={`answer-btn${selected ? ' selected' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span dangerouslySetInnerHTML={{ __html: label }} />
      {description && (
        <span
          className="opt-desc"
          dangerouslySetInnerHTML={{ __html: description }}
        />
      )}
    </button>
  );
}
