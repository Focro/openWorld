import type { PersonalityTraits, ScheduleEntry } from "../../../engine/types";
import type { AppearanceIdentity } from "../../../engine/appearance";
import { createAppearanceState } from "../../../engine/appearance";
import type { StateId } from "../populations";
import type { ResidentDef, ResidentPassport } from "./types";

export interface ResidentSpec {
  id: string;
  name: string;
  settlementId: string;
  originStateId: StateId;
  sex: ResidentPassport["sex"];
  birth: ResidentPassport["birth"];
  birthplaceId?: string;
  occupation: string;
  household: string;
  homeId: string;
  roleTags: NonNullable<ResidentDef["roleTags"]>;
  faith?: ResidentPassport["faith"];
  look: AppearanceIdentity;
  hairstyle: string;
  facialHair?: string;
  clothing: string;
  build: string;
  temperament: string;
  traits: PersonalityTraits;
  values: string[];
  formative: string[];
  coping: string[];
  habits: Array<{ id: string; label: string; trigger: string; strength: number }>;
  goals: string[];
  fears: string[];
  speech: string;
  quirks: string[];
  secret?: string;
  links: ResidentPassport["links"];
  schedule: ScheduleEntry[];
}

/** Собирает жителя в обычный NpcDef движка плюс паспорт жителя. */
export function resident(spec: ResidentSpec): ResidentDef {
  const appearance = createAppearanceState({ ...spec.look, description: spec.build }, { hairstyle: spec.hairstyle, clothing: spec.clothing });
  return {
    id: spec.id,
    name: spec.name,
    homeId: spec.homeId,
    birthYear: spec.birth.year,
    birthday: { month: spec.birth.month, day: spec.birth.day },
    speechNote: spec.speech,
    goals: spec.goals,
    roleTags: spec.roleTags,
    originStateId: spec.originStateId,
    appearance: spec.facialHair ? { ...appearance, facialHair: spec.facialHair } : appearance,
    personality: {
      temperament: spec.temperament,
      traits: spec.traits,
      values: spec.values,
      formativeExperiences: spec.formative,
      copingPatterns: spec.coping,
      initialHabits: spec.habits
    },
    schedule: spec.schedule,
    resident: {
      settlementId: spec.settlementId,
      sex: spec.sex,
      birth: spec.birth,
      ...(spec.birthplaceId ? { birthplaceId: spec.birthplaceId } : {}),
      occupation: spec.occupation,
      household: spec.household,
      build: spec.build,
      speech: spec.speech,
      quirks: spec.quirks,
      fears: spec.fears,
      ...(spec.secret ? { secret: spec.secret } : {}),
      links: spec.links,
      ...(spec.faith ? { faith: spec.faith } : {}),
      provenance: "proposal"
    }
  };
}
