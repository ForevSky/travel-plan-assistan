import { Image, Tag } from "antd";
import {
  CameraOutlined,
  CoffeeOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";
import type { ImageCategory } from "../utils/imageResolver";
import { categoryLabel, resolveTravelImage } from "../utils/imageResolver";

export interface ImageCardProps {
  name: string;
  category: ImageCategory;
  description?: string;
  compact?: boolean;
}

function categoryIcon(category: ImageCategory) {
  if (category === "景点") return <EnvironmentOutlined />;
  if (category === "小吃" || category === "美食") return <CoffeeOutlined />;
  return <CameraOutlined />;
}

export default function ImageCard({
  name,
  category,
  description,
  compact = false,
}: ImageCardProps) {
  const { src, isPlaceholder } = resolveTravelImage(name, category);

  return (
    <div className={`travel-image-card${compact ? " travel-image-card--compact" : ""}`}>
      <div className="travel-image-card__media">
        <Image
          src={src}
          alt={name}
          preview={!isPlaceholder}
          fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='260'%3E%3Crect fill='%23f1f5f9' width='400' height='260'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2394a3b8' font-size='14'%3E暂无图片%3C/text%3E%3C/svg%3E"
          className="travel-image-card__img"
        />
        <Tag className={`travel-image-card__tag travel-image-card__tag--${category}`}>
          {categoryIcon(category)}
          <span>{categoryLabel(category)}</span>
        </Tag>
      </div>
      <div className="travel-image-card__body">
        <div className="travel-image-card__name">{name}</div>
        {description && (
          <div className="travel-image-card__desc">{description}</div>
        )}
      </div>
    </div>
  );
}
