import { Tag } from "antd";
import type { DayPlan } from "../parsers/parseTravelPlan";

const PERIOD_COLORS: Record<string, string> = {
  上午: "blue",
  中午: "orange",
  午餐: "orange",
  下午: "green",
  晚间: "purple",
  晚上: "purple",
  夜间: "purple",
  早餐: "cyan",
  晚餐: "magenta",
};

interface DayTimelineProps {
  days: DayPlan[];
}

export default function DayTimeline({ days }: DayTimelineProps) {
  return (
    <div className="travel-day-timeline">
      {days.map((day) => (
        <div key={day.day} className="travel-day-timeline__day">
          <div className="travel-day-timeline__day-header">
            <span className="travel-day-timeline__day-badge">Day {day.day}</span>
            <span className="travel-day-timeline__day-title">{day.title}</span>
          </div>

          <div className="travel-day-timeline__slots">
            {day.slots.map((slot, idx) => (
              <div key={`${day.day}-${idx}`} className="travel-day-timeline__slot">
                <div className="travel-day-timeline__slot-head">
                  <Tag color={PERIOD_COLORS[slot.period] || "default"}>
                    {slot.period}
                  </Tag>
                  <span className="travel-day-timeline__slot-title">{slot.title}</span>
                  {slot.refIds.map((id) => (
                    <Tag key={id} className="travel-day-timeline__ref">
                      #{id}
                    </Tag>
                  ))}
                </div>
                {slot.details.length > 0 && (
                  <ul className="travel-day-timeline__details">
                    {slot.details.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {day.summary && (
            <div className="travel-day-timeline__summary">
              <Tag color="processing">交通小结</Tag>
              <span>{day.summary.replace(/^当?日?交通(?:小贴士|小结)[：:]\s*/, "")}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
