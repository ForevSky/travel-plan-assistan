import type { ImageTagItem } from "../parsers/parseTravelPlan";
import ImageCard from "./ImageCard";

interface ImageGalleryProps {
  images: ImageTagItem[];
  label: string;
}

export default function ImageGallery({ images, label }: ImageGalleryProps) {
  if (images.length === 0) return null;

  return (
    <div className="travel-plan__inline-gallery">
      <div className="travel-plan__gallery-label">{label}</div>
      <div className="travel-plan__gallery">
        {images.map((item) => (
          <ImageCard
            key={`${label}-${item.name}`}
            name={item.name}
            category={item.category}
            description={item.description}
          />
        ))}
      </div>
    </div>
  );
}
