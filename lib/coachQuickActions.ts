export interface QuickAction {
  label: string;
  message: string;
  icon: { ios: string; android: string; web: string };
  color: string;
}

export const COACH_QUICK_ACTIONS: QuickAction[] = [
  {
    label: "I feel urge",
    message: "I'm feeling a strong urge right now.",
    icon: {
      ios: "exclamationmark.triangle.fill",
      android: "warning",
      web: "warning",
    },
    color: "#EF4444",
  },
  {
    label: "I'm distracted",
    message: "I can't focus and keep getting distracted.",
    icon: {
      ios: "eyes.inverse",
      android: "visibility_off",
      web: "visibility_off",
    },
    color: "#F59E0B",
  },
  {
    label: "Motivate me",
    message: "I'm feeling low on motivation today.",
    icon: { ios: "bolt.fill", android: "bolt", web: "bolt" },
    color: "#4ADE80",
  },
  {
    label: "I relapsed",
    message: "I relapsed. What should I do now?",
    icon: {
      ios: "arrow.counterclockwise",
      android: "refresh",
      web: "refresh",
    },
    color: "#818CF8",
  },
  {
    label: "Stop scrolling",
    message: "I have an urge to scroll and waste time. Stop me.",
    icon: { ios: "hand.raised.fill", android: "pan_tool", web: "pan_tool" },
    color: "#FB7185",
  },
  {
    label: "Night urges",
    message: "It's night and I'm feeling urge. What should I do right now?",
    icon: { ios: "moon.fill", android: "nights_stay", web: "nights_stay" },
    color: "#A78BFA",
  },
  {
    label: "Screen time check",
    message: "Check my screen time and tell me what to do.",
    icon: { ios: "hourglass", android: "schedule", web: "schedule" },
    color: "#22D3EE",
  },
  {
    label: "Fix my plan",
    message: "I'm distracted and need a simple plan for the next 30 minutes.",
    icon: {
      ios: "list.bullet.rectangle.portrait",
      android: "checklist",
      web: "checklist",
    },
    color: "#FBBF24",
  },
  {
    label: "Feeling bored",
    message: "I'm bored and my brain wants easy dopamine. Help me stop.",
    icon: { ios: "zzz", android: "bedtime", web: "bedtime" },
    color: "#60A5FA",
  },
  {
    label: "Negative thoughts",
    message: "I'm stuck in negative thoughts and I feel weak right now.",
    icon: { ios: "cloud.rain.fill", android: "cloud", web: "cloud" },
    color: "#94A3B8",
  },
  {
    label: "Body trembling",
    message:
      "My body is trembling and I feel anxious. What should I do right now?",
    icon: {
      ios: "waveform.path.ecg",
      android: "monitor_heart",
      web: "monitor_heart",
    },
    color: "#F97316",
  },
  {
    label: "Uncomfortable",
    message:
      "I feel uncomfortable and restless. Give me a simple action to do now.",
    icon: {
      ios: "exclamationmark.circle.fill",
      android: "error",
      web: "error",
    },
    color: "#E879F9",
  },
];

