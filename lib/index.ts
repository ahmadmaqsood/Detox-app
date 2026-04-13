export { generateResponse, getAutoMessage } from "./aiEngine";
export { getUserContext, type UserContext } from "./contextBuilder";
export {
  evaluateUserLevel,
  formatUserLevelLabel,
  getLevelBlurb,
  loadUserLevelState,
  type RelapseTrend,
  type UserLevel,
  type UserLevelState,
} from "./userLevel";
export * from "./database";
export { buildDietInsights } from "./dietInsights";
export { computeEnergyScore } from "./energyScore";
export * from "./lifeOS";
export {
  calculateRisk,
  getInterventionMessage,
  getRiskColor,
  getRiskLabel,
  type RiskInput, type RiskLevel, type RiskResult
} from "./riskEngine";
export {
  defaultHabits,
  homeRoutineHabitsV3,
  type SeedHabit,
} from "./seed";
export * from "./types";

