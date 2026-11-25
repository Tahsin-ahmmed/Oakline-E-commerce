import type { Channel } from "@/lib/analytics/attribution";

/** Fixed, distinguishable colours per channel (consistent across every chart and table). */
export const CHANNEL_COLORS: Record<Channel, string> = {
  paid_social: "#b08a4a",
  organic_social: "#5b7bb5",
  paid_search: "#7a5c99",
  organic_search: "#3f8f6b",
  ai: "#c4643f",
  email: "#8c7f6e",
  referral: "#d4b26a",
  direct: "#3a3633",
};

export function channelColor(channel: string) {
  return CHANNEL_COLORS[channel as Channel] ?? "#9a948c";
}
