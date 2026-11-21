import { REGIONS } from "./atlas";

export type ContinentStatus = "playable" | "rumored" | "locked";
export interface ContinentRecord {
  id: string; name: string; epithet: string; status: ContinentStatus;
  knowledge: "well-known" | "partial" | "fragmentary";
  description: string; knownStates: string[];
}
export const CONTINENTS: ContinentRecord[] = [
  { id:"ardan", name:"Ардан", epithet:"Материк шести держав", status:"playable", knowledge:"well-known", description:"Основной материк первой кампании: шесть государств, внутреннее море, старые дороги, горные перевалы и торговые побережья.", knownStates:["estran","sahrad","tharvek","varent","elyndor","kharum"] },
  { id:"nar-il", name:"Нар-Ил", epithet:"Земли за Открытым морем", status:"rumored", knowledge:"fragmentary", description:"Западный материк, известный по рассказам мореходов, редким картам и необычным товарам. Достоверные сведения ограничены.", knownStates:[] },
  { id:"ur-tal", name:"Ур-Тал", epithet:"Восточные высокие земли", status:"locked", knowledge:"partial", description:"Далёкие плато и города за соляными пустошами. Путевые записи противоречат друг другу.", knownStates:[] }
];
export interface StartChoice { continentId:string; stateId?:string; regionId?:string; settlementId?:string; startPointId?:string; }
export interface CharacterOriginContext { originId:string; houseId?:string; citizenshipStateId?:string; exileFromStateId?:string; refugeeFromStateId?:string; profession?:string; }
export type StartResolution = { ok:true; choice:StartChoice; explanation:string } | { ok:false; reason:string };
const STATES = new Set(["estran","sahrad","tharvek","varent","elyndor","kharum"]);
export const VELORIA_START_SETTLEMENT_ID = "roven";
const ROVEN_START_POINTS = new Set(["market-square","lower-market","town-hall","grey-fox","south-gate","upper-street","smithy","temple","river-dock","old-quarter","guild-house"]);
export function resolveStart(choice:StartChoice, origin:CharacterOriginContext):StartResolution {
  const continent = CONTINENTS.find(c=>c.id===choice.continentId);
  if(!continent) return {ok:false,reason:"Неизвестный континент."};
  if(continent.status!=="playable") return {ok:false,reason:"Эта земля пока недоступна для обычного старта: нужны отдельный сценарий и подтверждённые знания."};
  if(choice.stateId && !STATES.has(choice.stateId)) return {ok:false,reason:"Государство происхождения не относится к Ардану."};
  if(choice.regionId) {
    const region = REGIONS.find(r => r.id === choice.regionId);
    if(!region || !choice.stateId || region.countryId !== choice.stateId) return {ok:false,reason:"Регион не принадлежит выбранному государству происхождения."};
  }
  if(choice.settlementId && choice.settlementId !== VELORIA_START_SETTLEMENT_ID) return {ok:false,reason:"Обычный старт Велории всегда происходит в Ровене. В другое поселение можно попасть только путешествием после начала игры."};
  if(choice.startPointId && !ROVEN_START_POINTS.has(choice.startPointId)) return {ok:false,reason:"Точка старта должна находиться внутри Ровена."};
  if(origin.houseId && origin.citizenshipStateId && choice.stateId && origin.citizenshipStateId!==choice.stateId && !origin.exileFromStateId && !origin.refugeeFromStateId && origin.originId!=="wanderer") {
    return {ok:false,reason:"Выбранное государство не совпадает с происхождением. Укажи изгнание, бегство, переселение или чужеземное происхождение."};
  }
  if(origin.exileFromStateId && choice.stateId===origin.exileFromStateId) return {ok:false,reason:"Изгнанник не может начать в государстве, из которого он изгнан, без особого сценария."};
  return {ok:true,choice:{...choice,settlementId:VELORIA_START_SETTLEMENT_ID,startPointId:choice.startPointId ?? "market-square"},explanation:"Персонаж начинает в Ровене. Выбранное государство описывает происхождение/гражданство, а не место появления; стартовая точка и ресурсы должны соответствовать биографии."};
}
