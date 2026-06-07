import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import TravelPlanContent from "@/features/travel-plan/components/TravelPlanContent";
import {
  isTravelPlanContent,
  parseTravelPlan,
  stripGalleryFromText,
} from "@/features/travel-plan/parsers/parseTravelPlan";
import { parseMarkdownTable, splitMarkdownSegments } from "./parseTable";
import "./index.less";

const { Title, Paragraph, Text } = Typography;

interface MarkdownContentProps {
  content: string;
}

function MarkdownTable({ markdown }: { markdown: string }) {
  const parsed = parseMarkdownTable(markdown);
  if (!parsed) {
    return (
      <pre className="markdown-content__table-fallback">{markdown}</pre>
    );
  }

  const columns: ColumnsType<Record<string, string>> = parsed.headers.map(
    (header, index) => ({
      title: header,
      dataIndex: `col_${index}`,
      key: `col_${index}`,
      ellipsis: true,
    })
  );

  const dataSource = parsed.rows.map((row, rowIndex) => {
    const record: Record<string, string> = { key: String(rowIndex) };
    parsed.headers.forEach((_, colIndex) => {
      record[`col_${colIndex}`] = row[colIndex] ?? "";
    });
    return record;
  });

  return (
    <div className="markdown-content__table-wrap">
      <Table
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        size="small"
        bordered
        scroll={{ x: "max-content" }}
        className="markdown-content__table"
      />
    </div>
  );
}

const mdComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <Title level={4} className="markdown-content__heading">
      {children}
    </Title>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <Title level={5} className="markdown-content__heading">
      {children}
    </Title>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <Text strong className="markdown-content__subheading">
      {children}
    </Text>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <Paragraph className="markdown-content__paragraph">{children}</Paragraph>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="markdown-content__list">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="markdown-content__list markdown-content__list--ordered">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="markdown-content__list-item">{children}</li>
  ),
  table: () => null,
};

function MarkdownBlock({ text }: { text: string }) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
      {trimmed}
    </ReactMarkdown>
  );
}

export default function MarkdownContent({ content }: MarkdownContentProps) {
  const parsed = parseTravelPlan(content);
  const planSections = parsed.sections.filter((s) => s.key !== "gallery");

  if (isTravelPlanContent(content) && planSections.length > 0) {
    return (
      <div className="markdown-content markdown-content--plan">
        <TravelPlanContent content={content} />
      </div>
    );
  }

  const segments = splitMarkdownSegments(stripGalleryFromText(content));

  return (
    <div className="markdown-content">
      {segments.map((seg, index) =>
        seg.type === "table" ? (
          <MarkdownTable key={`table-${index}`} markdown={seg.value} />
        ) : (
          <MarkdownBlock key={`text-${index}`} text={seg.value} />
        )
      )}
    </div>
  );
}
