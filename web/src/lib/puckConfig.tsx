import type { Config } from "@puckeditor/core";

function TextPreview({ content, fontSize, fontWeight, color, textAlign }: any) {
  return (
    <div
      style={{
        fontSize: fontSize || 16,
        fontWeight: fontWeight || "normal",
        color: color || "#000",
        textAlign: textAlign || "left",
        padding: '4px 0',
      }}
    >
      {content || "Text"}
    </div>
  );
}

function ButtonPreview({ label, variant, size, actionType, actionTarget }: any) {
  const variants: Record<string, string> = {
    primary: "bg-blue-600 text-white",
    secondary: "bg-gray-200 text-gray-800",
    outline: "border border-gray-300 text-gray-800",
    ghost: "text-gray-600",
    danger: "bg-red-600 text-white",
  };
  const sizes: Record<string, string> = {
    small: "px-3 py-1 text-sm",
    medium: "px-4 py-2",
    large: "px-6 py-3 text-lg",
  };
  return (
    <div>
      <button
        className={`rounded-md font-medium ${variants[variant] || variants.primary} ${sizes[size] || sizes.medium}`}
      >
        {label || "Button"}
      </button>
      {actionType && actionType !== 'none' && (
        <div className="text-xs text-gray-400 mt-1">
          ⚡ {actionType}{actionTarget ? `: ${actionTarget}` : ''}
        </div>
      )}
    </div>
  );
}

function ImagePreview({ uri, height, borderRadius }: any) {
  return (
    <img
      src={uri || "https://via.placeholder.com/300x200"}
      style={{
        width: "100%",
        height: height || 200,
        borderRadius: borderRadius || 0,
        objectFit: "cover",
      }}
      alt=""
    />
  );
}

function MarkdownPreview({ content }: any) {
  return (
    <div className="prose prose-sm max-w-none" style={{ whiteSpace: "pre-wrap" }}>
      {content || "# Heading\n\nParagraph"}
    </div>
  );
}

function DividerPreview({ color, thickness, margin }: any) {
  return (
    <hr
      style={{
        borderColor: color || "#E0E0E0",
        borderWidth: thickness || 1,
        margin: `${margin || 8}px 0`,
      }}
    />
  );
}

function IconPreview({ name, size, color }: any) {
  return (
    <span style={{ fontSize: size || 24, color: color || "#000" }}>
      ⭐ {name || "star"}
    </span>
  );
}

function TextInputPreview({ placeholder, label, multiline }: any) {
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}
      {multiline ? (
        <textarea
          placeholder={placeholder || "Enter text..."}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          rows={3}
          readOnly
        />
      ) : (
        <input
          type="text"
          placeholder={placeholder || "Enter text..."}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          readOnly
        />
      )}
    </div>
  );
}

function CalendarPreview({ showTimeBlock, defaultView }: any) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="text-lg font-bold mb-3">📅 Calendar Module</div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-2">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="font-medium">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {Array.from({ length: 30 }, (_, i) => (
          <div
            key={i}
            className={`py-1 rounded ${i === 4 ? "bg-blue-600 text-white" : "hover:bg-gray-100"}`}
          >
            {i + 1}
          </div>
        ))}
      </div>
      {showTimeBlock !== false && (
        <div className="mt-3 border-t pt-3 text-xs text-gray-400">
          <div className="font-medium text-gray-600 mb-1">
            Time Block View ({defaultView || "month"})
          </div>
          <div className="space-y-1">
            <div className="bg-blue-50 rounded p-1">9:00 AM - Team Standup</div>
            <div className="bg-green-50 rounded p-1">2:00 PM - Design Review</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatPreview() {
  return (
    <div className="bg-white rounded-lg border p-4 max-h-[300px]">
      <div className="text-lg font-bold mb-3">💬 Chat Module</div>
      <div className="space-y-3">
        <div className="flex gap-2">
          <span className="bg-gray-100 rounded-lg px-3 py-2 text-sm">
            Hi! How can I help?
          </span>
        </div>
        <div className="flex gap-2 justify-end">
          <span className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm">
            Show me today&apos;s events
          </span>
        </div>
        <div className="flex gap-2">
          <span className="bg-gray-100 rounded-lg px-3 py-2 text-sm">
            You have 2 events today...
          </span>
        </div>
      </div>
    </div>
  );
}

function NotesPreview() {
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="text-lg font-bold mb-3">📓 Notes Module</div>
      <div className="text-sm text-gray-500 space-y-2">
        <p>Meeting notes from April 5th...</p>
        <p className="text-gray-400">Start typing to edit...</p>
      </div>
    </div>
  );
}

function InputBarPreview({ placeholder }: any) {
  return (
    <div className="bg-white rounded-lg border p-3 flex gap-2">
      <input
        type="text"
        placeholder={placeholder || "Type a message..."}
        className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm"
        readOnly
      />
      <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm">Send</button>
    </div>
  );
}

export function buildPuckConfig(): Config {
  return {
    components: {
      Row: {
        fields: {
          cells: { type: "slot" as const },
          height: {
            type: "text" as const,
            label: "Row Height",
          },
        },
        defaultProps: { height: "auto" },
        render: ({ cells }: any) => (
          <div
            style={{
              minHeight: 40,
              padding: '4px 0',
              border: '1px dashed #d1d5db',
              borderRadius: 6,
              background: '#f9fafb',
            }}
          >
            {cells({ style: { display: 'flex', flexDirection: 'row' as const, gap: 8, minHeight: 32, padding: 4 } })}
          </div>
        ),
      },
      Text: {
        fields: {
          content: { type: "text" as const, label: "Content" },
          fontSize: { type: "number" as const, label: "Font Size" },
          fontWeight: {
            type: "select" as const,
            label: "Font Weight",
            options: [
              { label: "Normal", value: "normal" },
              { label: "Bold", value: "bold" },
              { label: "Semibold", value: "semibold" },
            ],
          },
          color: { type: "text" as const, label: "Color" },
          textAlign: {
            type: "select" as const,
            label: "Text Align",
            options: [
              { label: "Left", value: "left" },
              { label: "Center", value: "center" },
              { label: "Right", value: "right" },
            ],
          },
        },
        defaultProps: {
          content: "Text",
          fontSize: 16,
          fontWeight: "normal",
          color: "#000000",
          textAlign: "left",
        },
        render: ({ content, fontSize, fontWeight, color, textAlign }: any) => (
          <TextPreview
            content={content}
            fontSize={fontSize}
            fontWeight={fontWeight}
            color={color}
            textAlign={textAlign}
          />
        ),
      },
      Markdown: {
        fields: {
          content: { type: "textarea" as const, label: "Content" },
        },
        defaultProps: { content: "# Heading\n\nParagraph text" },
        render: ({ content }: any) => <MarkdownPreview content={content} />,
      },
      Button: {
        fields: {
          label: { type: "text" as const, label: "Label" },
          variant: {
            type: "select" as const,
            label: "Variant",
            options: [
              { label: "Primary", value: "primary" },
              { label: "Secondary", value: "secondary" },
              { label: "Outline", value: "outline" },
              { label: "Ghost", value: "ghost" },
              { label: "Danger", value: "danger" },
            ],
          },
          size: {
            type: "select" as const,
            label: "Size",
            options: [
              { label: "Small", value: "small" },
              { label: "Medium", value: "medium" },
              { label: "Large", value: "large" },
            ],
          },
          actionType: {
            type: "select" as const,
            label: "Action Type",
            options: [
              { label: "None", value: "none" },
              { label: "Navigate", value: "navigate" },
              { label: "Server Action", value: "server_action" },
              { label: "Open URL", value: "open_url" },
              { label: "Go Back", value: "go_back" },
              { label: "Send to Agent", value: "send_to_agent" },
            ],
          },
          actionTarget: {
            type: "text" as const,
            label: "Action Target (module/URL/function)",
          },
          actionParams: {
            type: "textarea" as const,
            label: "Action Params (JSON)",
          },
        },
        defaultProps: {
          label: "Button",
          variant: "primary",
          size: "medium",
          actionType: "none",
          actionTarget: "",
          actionParams: "",
        },
        render: ({ label, variant, size, actionType, actionTarget }: any) => (
          <ButtonPreview
            label={label}
            variant={variant}
            size={size}
            actionType={actionType}
            actionTarget={actionTarget}
          />
        ),
      },
      Image: {
        fields: {
          uri: { type: "text" as const, label: "Image URL" },
          height: { type: "number" as const, label: "Height" },
          borderRadius: { type: "number" as const, label: "Border Radius" },
        },
        defaultProps: {
          uri: "https://via.placeholder.com/300x200",
          height: 200,
          borderRadius: 0,
        },
        render: ({ uri, height, borderRadius }: any) => (
          <ImagePreview uri={uri} height={height} borderRadius={borderRadius} />
        ),
      },
      TextInput: {
        fields: {
          placeholder: { type: "text" as const, label: "Placeholder" },
          label: { type: "text" as const, label: "Label" },
          multiline: {
            type: "radio" as const,
            label: "Multiline",
            options: [
              { label: "No", value: false },
              { label: "Yes", value: true },
            ],
          },
          maxLength: { type: "number" as const, label: "Max Length" },
        },
        defaultProps: { placeholder: "Enter text...", label: "", multiline: false, maxLength: 0 },
        render: ({ placeholder, label, multiline }: any) => (
          <TextInputPreview placeholder={placeholder} label={label} multiline={multiline} />
        ),
      },
      Icon: {
        fields: {
          name: { type: "text" as const, label: "Icon Name" },
          size: { type: "number" as const, label: "Size" },
          color: { type: "text" as const, label: "Color" },
        },
        defaultProps: { name: "star", size: 24, color: "#000000" },
        render: ({ name, size, color }: any) => (
          <IconPreview name={name} size={size} color={color} />
        ),
      },
      Divider: {
        fields: {
          color: { type: "text" as const, label: "Color" },
          thickness: { type: "number" as const, label: "Thickness" },
          margin: { type: "number" as const, label: "Margin" },
        },
        defaultProps: { color: "#E0E0E0", thickness: 1, margin: 8 },
        render: ({ color, thickness, margin }: any) => (
          <DividerPreview color={color} thickness={thickness} margin={margin} />
        ),
      },
      Calendar: {
        fields: {
          showTimeBlock: {
            type: "radio" as const,
            label: "Show Time Block",
            options: [
              { label: "Yes", value: true },
              { label: "No", value: false },
            ],
          },
          defaultView: {
            type: "select" as const,
            label: "Default View",
            options: [
              { label: "Month", value: "month" },
              { label: "Week", value: "week" },
              { label: "Day", value: "day" },
            ],
          },
        },
        defaultProps: { showTimeBlock: true, defaultView: "month" },
        render: ({ showTimeBlock, defaultView }: any) => (
          <CalendarPreview showTimeBlock={showTimeBlock} defaultView={defaultView} />
        ),
      },
      Chat: {
        fields: {
          showHistory: {
            type: "radio" as const,
            label: "Show History",
            options: [
              { label: "Yes", value: true },
              { label: "No", value: false },
            ],
          },
        },
        defaultProps: { showHistory: true },
        render: () => <ChatPreview />,
      },
      Notes: {
        fields: {},
        defaultProps: {},
        render: () => <NotesPreview />,
      },
      InputBar: {
        fields: {
          placeholder: { type: "text" as const, label: "Placeholder" },
        },
        defaultProps: { placeholder: "Type a message..." },
        render: ({ placeholder }: any) => <InputBarPreview placeholder={placeholder} />,
      },
    },
    root: {
      fields: {},
      render: ({ children }: any) => (
        <div
          style={{
            maxWidth: 390,
            margin: "0 auto",
            minHeight: "100%",
            background: "#ffffff",
            fontFamily: "-apple-system, sans-serif",
            padding: '8px',
          }}
        >
          {children}
        </div>
      ),
    },
  };
}