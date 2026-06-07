import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CalendarOutlined,
  CarOutlined,
  CloudOutlined,
  CompassOutlined,
  DollarOutlined,
  FileProtectOutlined,
  InfoCircleOutlined,
  RestOutlined,
  ScheduleOutlined,
  TableOutlined,
} from "@ant-design/icons";
import { parseMarkdownTable } from "@/shared/components/MarkdownContent/parseTable";
import DayTimeline from "./DayTimeline";
import ImageGallery from "./ImageGallery";
import { parseTravelPlan, stripGalleryFromText } from "../parsers/parseTravelPlan";
import "./TravelPlanContent.less";

const { Paragraph } = Typography;

const SECTION_ICONS: Record<string, React.ReactNode> = {
  overview: <CompassOutlined />,
  weather: <CloudOutlined />,
  daily: <ScheduleOutlined />,
  food: <RestOutlined />,
  spots: <TableOutlined />,
  traffic: <CarOutlined />,
  notes: <InfoCircleOutlined />,
  budget: <DollarOutlined />,
  disclaimer: <FileProtectOutlined />,
};

function SimpleMarkdown({ text }: { text: string }) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => (
          <Paragraph className="travel-plan__md-p">{children}</Paragraph>
        ),
        li: ({ children }) => <li className="travel-plan__md-li">{children}</li>,
        ul: ({ children }) => <ul className="travel-plan__md-ul">{children}</ul>,
        ol: ({ children }) => <ol className="travel-plan__md-ol">{children}</ol>,
        h4: ({ children }) => <h4 className="travel-plan__md-h4">{children}</h4>,
        strong: ({ children }) => <strong>{children}</strong>,
      }}
    >
      {trimmed}
    </ReactMarkdown>
  );
}

function PlanTable({ markdown }: { markdown: string }) {
  const parsed = parseMarkdownTable(markdown);
  if (!parsed) {
    return <pre className="travel-plan__table-fallback">{markdown}</pre>;
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
    <Table
      columns={columns}
      dataSource={dataSource}
      pagination={false}
      size="small"
      bordered
      scroll={{ x: "max-content" }}
      className="travel-plan__table"
    />
  );
}

function splitTextAndTable(content: string): Array<{ type: "text" | "table"; value: string }> {
  const parts: Array<{ type: "text" | "table"; value: string }> = [];
  const tableRe = /(\|[^\n]+\|\n(?:\|[-:| ]+\|\n)?(?:\|[^\n]+\|\n?)+)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = tableRe.exec(content)) !== null) {
    if (match.index > last) {
      parts.push({ type: "text", value: content.slice(last, match.index) });
    }
    parts.push({ type: "table", value: match[1].trim() });
    last = match.index + match[0].length;
  }
  if (last < content.length) {
    parts.push({ type: "text", value: content.slice(last) });
  }
  return parts.length ? parts : [{ type: "text", value: content }];
}

interface TravelPlanContentProps {
  content: string;
}

function filterSpotImages(images: ReturnType<typeof parseTravelPlan>["allImages"]) {
  return images.filter((i) => i.category === "景点");
}

function filterFoodImages(images: ReturnType<typeof parseTravelPlan>["allImages"]) {
  return images.filter((i) => i.category === "小吃" || i.category === "美食");
}

export default function TravelPlanContent({ content }: TravelPlanContentProps) {
  const parsed = parseTravelPlan(content);

  if (!parsed.isPlan) return null;

  const spotImages = filterSpotImages(parsed.allImages);
  const foodImages = filterFoodImages(parsed.allImages);

  return (
    <div className="travel-plan">
      {parsed.sections
        .filter((s) => s.key !== "gallery")
        .map((section) => (
          <React.Fragment key={section.key}>
            <section className={`travel-plan__section travel-plan__section--${section.key}`}>
              <div className="travel-plan__section-head">
                <span className="travel-plan__section-icon">
                  {SECTION_ICONS[section.key] || <CalendarOutlined />}
                </span>
                <h3 className="travel-plan__section-title">{section.title}</h3>
              </div>

              <div className="travel-plan__section-body">
                {section.key === "daily" && section.days && section.days.length > 0 ? (
                  <DayTimeline days={section.days} />
                ) : (
                  splitTextAndTable(stripGalleryFromText(section.content)).map((part, idx) =>
                    part.type === "table" ? (
                      <PlanTable key={`${section.key}-table-${idx}`} markdown={part.value} />
                    ) : (
                      <SimpleMarkdown key={`${section.key}-text-${idx}`} text={part.value} />
                    )
                  )
                )}

                {section.key === "daily" && spotImages.length > 0 && (
                  <ImageGallery images={spotImages} label="景区景点" />
                )}
                {section.key === "food" && foodImages.length > 0 && (
                  <ImageGallery images={foodImages} label="特色美食" />
                )}
              </div>
            </section>
          </React.Fragment>
        ))}
    </div>
  );
}
