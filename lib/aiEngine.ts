import type { UserContext } from './contextBuilder';

// ─── Personality: Direct. No excuses. Action-oriented. ────────

const URGE_WORDS = ['urge', 'tempt', 'craving', 'want to watch', 'feeling weak', 'can\'t resist'];
const RELAPSE_WORDS = ['relapse', 'relapsed', 'failed', 'fell', 'gave in', 'messed up', 'slipped'];
const MOTIVATION_WORDS = ['motivat', 'tired', 'lazy', 'don\'t feel like', 'no energy', 'why bother', 'give up'];
const DISTRACTION_WORDS = ['distract', 'focus', 'can\'t concentrate', 'scrolling', 'wasting time', 'procrastinat'];
const SCREEN_WORDS = ['screen time', 'phone', 'too much screen', 'addicted to phone'];
const STREAK_WORDS = ['streak', 'how many days', 'my progress'];
const GREETING_WORDS = ['hi', 'hello', 'hey', 'salam', 'assalam'];

function matches(msg: string, words: string[]): boolean {
  const lower = msg.toLowerCase();
  return words.some((w) => lower.includes(w));
}

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

const URGE_RESPONSES = [
  "Stop. Stand up right now. Leave the room. The urge passes in 15 minutes. Move.",
  "This is temporary. Do 20 pushups. Splash cold water. You've beaten this before.",
  "Get up. Go make wudu. Pray 2 rakat. The urge will die. You won't.",
  "Put the phone in another room. Walk outside. Breathe. You're stronger than a moment.",
  "Your brain is lying to you right now. It wants cheap dopamine. Don't give in. Move your body.",
];

const RELAPSE_RESPONSES = [
  "You didn't fail. You fell. Now get up. Do wudu. Pray. Reset the counter. Start now.",
  "One slip doesn't erase your progress. But spiraling will. Stop, pray, and restart immediately.",
  "Shame is the enemy, not you. Log it honestly. Identify the trigger. Get back up right now.",
  "Reset. Don't sit in guilt — that's what causes the cycle. Act now. Pray. Move forward.",
  "Your streak number doesn't define you. Your decision to try again does. Start over. Now.",
];

const MOTIVATION_RESPONSES = [
  "Discipline isn't a feeling. It's a decision. You made that decision. Now act on it.",
  "You don't need motivation. You need to do the next right thing. That's it. Go.",
  "Every day you show up is a vote for who you want to become. Vote now.",
  "Tired? Good. Do it tired. Champions don't wait for motivation. They move.",
  "You started this for a reason. That reason hasn't changed. Get up.",
];

const MOTIVATION_ADVANCED = [
  'Discipline = identity. Move.',
  'No debate. Next action now.',
  'You know the drill. Execute.',
];

const DISTRACTION_RESPONSES = [
  "Close everything. Pick one task. Set a 25-minute timer. No phone. Go.",
  "Your brain wants easy dopamine. Don't feed it. Put the phone face-down. Work for 10 minutes.",
  "Distraction is a choice. Choose focus. One task. One timer. Start.",
  "Stop scrolling. You know it's wasting time. Close the app. Do something real.",
  "Write down one thing you need to do. Just one. Do only that for 15 minutes.",
];

const GREETING_RESPONSES = [
  "Ready to work. What do you need?",
  "I'm here. What's the situation?",
  "Talk to me. What's going on?",
];

function nightCompletionThreshold(level: UserContext['level']): number {
  if (level === 'beginner') return 55;
  if (level === 'intermediate') return 50;
  return 45;
}

function getContextResponse(ctx: UserContext): string | null {
  const hiRisk = ctx.riskAlertThreshold;
  const soft = ctx.screenTimeSoftWarnAt;
  const hard = ctx.screenTimeAutoMessageAt;

  if (ctx.riskScore > hiRisk) {
    return pick([
      "Your risk is critical right now. Leave your phone. Go outside. Move.",
      "You're in the danger zone. Stop what you're doing. Pray. Walk. Now.",
      "Risk is high. This is the moment that matters. Put the phone down and leave the room.",
    ]);
  }

  if (ctx.screenTime > hard) {
    return pick([
      `You've crossed ${hard}+ minutes on screens. Stop. Put the phone away. Reset.`,
      `${ctx.screenTime} minutes of screen time. Your mind is overloaded. Stop scrolling.`,
      "Screen time is way too high. Lock your phone. Go outside for 15 minutes.",
    ]);
  }

  if (ctx.screenTime > soft) {
    return pick([
      "Screen time is climbing. Cut it now before it gets worse. Put the phone down.",
      `${ctx.screenTime} minutes on screens today. Slow down now.`,
    ]);
  }

  if (ctx.timeOfDay === 'night' && ctx.completionRate < nightCompletionThreshold(ctx.level)) {
    return pick([
      "It's late and completion is low. Finish what you can. Then sleep.",
      "Night window. Low completion. One more habit, then rest.",
    ]);
  }

  const goodBar = ctx.level === 'advanced' ? 75 : ctx.level === 'intermediate' ? 78 : 80;
  if (ctx.completionRate >= goodBar) {
    return pick([
      `${ctx.completionRate}% done today. Solid. Close it out.`,
      "Strong day. Don't waste it in the last stretch.",
      "Good discipline today. Maintain through tonight.",
    ]);
  }

  return null;
}

export function generateResponse(message: string, context: UserContext): string {
  if (matches(message, URGE_WORDS)) {
    const r = pick(URGE_RESPONSES);
    if (context.level === 'beginner')
      return `${r} One small win now beats a perfect plan later.`;
    return r;
  }
  if (matches(message, RELAPSE_WORDS)) {
    const r = pick(RELAPSE_RESPONSES);
    if (context.relapseTrend === 'improving' && context.level !== 'beginner')
      return `${r} Trend is improving — don't waste it on shame.`;
    return r;
  }
  if (matches(message, MOTIVATION_WORDS)) {
    if (context.level === 'advanced') return pick(MOTIVATION_ADVANCED);
    if (context.level === 'beginner')
      return `Start tiny: check one habit. ${pick(MOTIVATION_RESPONSES)}`;
    return pick(MOTIVATION_RESPONSES);
  }
  if (matches(message, DISTRACTION_WORDS)) {
    if (context.level === 'advanced') {
      return pick([
        'Timer. One task. Go.',
        'Eliminate inputs. Work 15m.',
        ...DISTRACTION_RESPONSES,
      ]);
    }
    return pick(DISTRACTION_RESPONSES);
  }

  const soft = context.screenTimeSoftWarnAt;
  if (matches(message, SCREEN_WORDS)) {
    if (context.screenTime > soft)
      return `${context.screenTime} minutes. That's too much for your level. Cut it now.`;
    if (context.screenTime > 0)
      return `${context.screenTime} minutes today. ${context.screenTime < 60 ? "Good. Keep it low." : "Watch it. Don't let it climb."}`;
    return "No screen time logged yet. Keep it that way.";
  }

  if (matches(message, STREAK_WORDS)) {
    if (context.streak === 0)
      return "Streak is at 0. Start building it today. One day at a time.";
    if (context.level === 'advanced' && context.streak >= 14)
      return `${context.streak} days. Stay ruthless. No complacency.`;
    if (context.streak < 7)
      return `${context.streak} days. Fragile. Protect it this week.`;
    return `${context.streak} days. Strong. Keep going.`;
  }

  if (matches(message, GREETING_WORDS)) {
    const ctx = getContextResponse(context);
    return ctx ? `${pick(GREETING_RESPONSES)} ${ctx}` : pick(GREETING_RESPONSES);
  }

  const contextResp = getContextResponse(context);
  if (contextResp) return contextResp;

  const defaults = [
    "What's the real problem? Be specific. I'll give you a plan.",
    "Talk to me. What's going on right now?",
    "Don't overthink it. Tell me what you're struggling with.",
    `${context.completionRate}% done today. ${context.completionRate < 50 ? "You need to move. Start with one habit." : "Keep going. What's next?"}`,
    "Action beats thinking. Pick one habit and do it right now.",
    "Focus on what you can control. What's the next right thing to do?",
  ];
  if (context.level === 'beginner')
    defaults.push('Pick the easiest habit on your list. Check it. Momentum beats planning.');
  if (context.level === 'advanced')
    defaults.push('You know what to do. Do it without negotiating.');

  return pick(defaults);
}

export function getAutoMessage(context: UserContext): string | null {
  if (context.riskScore > context.riskAlertThreshold) {
    return pick([
      "You're losing control. Stand up now.",
      "Danger zone. Leave your phone. Move your body. Pray.",
      "Risk is critical. Stop everything. Go outside.",
    ]);
  }

  if (context.screenTime > context.screenTimeAutoMessageAt) {
    return pick([
      "Stop. Put your phone away. Move.",
      "Screen time is too high. Lock the phone. Do something real.",
      "Screen time is dangerous. Stop scrolling.",
    ]);
  }

  return null;
}
