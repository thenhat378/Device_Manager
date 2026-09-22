import React from 'react';

interface AcademicMarkdownProps {
  content: string;
  isUser?: boolean;
}

export const AcademicMarkdown: React.FC<AcademicMarkdownProps> = ({ content, isUser = false }) => {
  if (!content) return null;

  // Split lines
  const lines = content.split('\n');

  const renderFormattedText = (text: string) => {
    // Replace **bold** with strong
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const inner = part.slice(2, -2);
        return (
          <strong
            key={index}
            className={`font-bold ${isUser ? 'text-white' : 'text-slate-900 font-semibold'}`}
          >
            {inner}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        const inner = part.slice(1, -1);
        return (
          <code
            key={index}
            className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${
              isUser
                ? 'bg-blue-800 text-blue-100 border border-blue-600'
                : 'bg-slate-100 text-blue-700 border border-slate-300'
            }`}
          >
            {inner}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className={`space-y-1.5 leading-relaxed text-xs sm:text-[13px] ${isUser ? 'text-white' : 'text-slate-800'}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Bullet point
        if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const bulletText = trimmed.slice(2);
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${isUser ? 'bg-blue-200' : 'bg-blue-600'}`} />
              <div className="flex-1">{renderFormattedText(bulletText)}</div>
            </div>
          );
        }

        // Numbered list item
        const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numberedMatch) {
          const [, num, numText] = numberedMatch;
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 my-0.5">
              <span
                className={`inline-flex items-center justify-center h-4.5 w-4.5 rounded-full text-[10px] font-bold shrink-0 mt-0.5 ${
                  isUser
                    ? 'bg-blue-800 text-white'
                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                }`}
              >
                {num}
              </span>
              <div className="flex-1">{renderFormattedText(numText)}</div>
            </div>
          );
        }

        return <p key={idx}>{renderFormattedText(line)}</p>;
      })}
    </div>
  );
};
