export type Climate = "temperate" | "hot-arid" | "hot-humid" | "cold" | "mountain";
export interface Country {
 id:string; name:string; government:string; ruler:string; capital:string; climate:Climate;
 culture:string; primaryFaith:string; languages:string[]; laws:string[]; exports:string[]; tensions:string[]; description:string;
}
export interface Region {id:string;countryId:string;name:string;terrain:string;resources:string[];notes:string}
export interface MapNode {id:string;name:string;countryId:string;regionId:string;kind:string;x:number;y:number;populationBand:string;climate:Climate;tags:string[]}
export interface Route {from:string;to:string;days:number;mode:"road"|"river"|"sea"|"mountain-pass";danger:"low"|"moderate"|"high";seasonalClosure?:string}

export const COUNTRIES:Country[]=[
{id:"estran",name:"Королевство Эстран",government:"наследственная монархия",ruler:"королева Элиана III",capital:"koronholm",climate:"temperate",culture:"эстранская",primaryFaith:"sevenfold",languages:["эстранский","староарданский"],laws:["вассальная военная служба","наследование преимущественно старшему законному ребёнку","гильдейское ученичество"],exports:["зерно","лён","железо"],tensions:["корона против крупных вассалов","задержки зерновых обозов"],description:"Земледельческое королевство на старых торговых дорогах."},
{id:"sahrad",name:"Сахрадский султанат",government:"династический султанат и наместники",ruler:"султан Рашид аль-Марун",capital:"qadira",climate:"hot-arid",culture:"сахрадская",primaryFaith:"path_of_wells",languages:["сахрадский","торговый арданский"],laws:["вода регулируется общинным и султанским правом","караванные договоры имеют силу печати","рабство и долговая зависимость имеют разные правовые основания"],exports:["соль","стекло","финики","пряности"],tensions:["борьба за оазисы","спор о престолонаследии"],description:"Жаркая страна пустынь и оазисов, где власть связана с водой и караванами."},
{id:"varent",name:"Вольные города Варента",government:"союз торговых республик",ruler:"Совет Семи Гаваней",capital:"varentport",climate:"temperate",culture:"варентская",primaryFaith:"open_lantern",languages:["варентский","эстранский","прибрежный койне"],laws:["гражданство связано с регистрацией и налогами","долговые контракты рассматриваются городскими судами"],exports:["корабли","книги","краски","банковские услуги"],tensions:["конкуренция торговых домов","пиратство"],description:"Морская конфедерация, где договор и капитал влиятельны."},
{id:"tharvek",name:"Тарвекские княжества",government:"союз горных князей и военных орденов",ruler:"Княжеский конклав",capital:"dravorn",climate:"mountain",culture:"тарвекская",primaryFaith:"stone_oath",languages:["тарвекский","староарданский"],laws:["перевалы охраняют заставы","земля наследуется по местному обычаю","часть общин несёт военную службу"],exports:["железо","олово","оружие"],tensions:["соперничество домов","закрытие перевалов"],description:"Холодные горы, крепости и шахтёрские общины."},
{id:"elyndor",name:"Элиндорская лига лесов",government:"союз городов и родовых советов",ruler:"Совет Старших Рощ",capital:"lethariel",climate:"cold",culture:"элиндорская",primaryFaith:"green_memory",languages:["элиндорский","лесной торговый"],laws:["лесные угодья принадлежат общинам и родам","рубка священных рощ запрещена"],exports:["древесина","лекарственные травы","смолы","меха"],tensions:["конфликт общин с лесорубами"],description:"Северные леса и озёрные земли с родовыми советами."},
{id:"kharum",name:"Кхарумская империя",government:"централизованная империя",ruler:"император Северан IV",capital:"har-kadar",climate:"hot-humid",culture:"кхарумская",primaryFaith:"imperial_sun",languages:["кхарумский","южный койне"],laws:["чиновничьи должности требуют экзамена","налоги собирают провинциальные управления","переселение фиксируется в реестрах"],exports:["рис","хлопок","сахар","керамика"],tensions:["придворные фракции","провинциальные восстания"],description:"Жаркая империя речных дельт, каналов и дворцовой бюрократии."}
];
export const REGIONS:Region[]=[
{id:"estran-heart",countryId:"estran",name:"Эстранское сердце",terrain:"речные долины и поля",resources:["зерно","лён","скот"],notes:"Столица и Ровен."},
{id:"estran-north",countryId:"estran",name:"Северные холмы",terrain:"холмы и леса",resources:["железо","камень","лес"],notes:"Зимой дороги трудны."},
{id:"sahrad-oasis",countryId:"sahrad",name:"Пояс оазисов",terrain:"пустыня и солончаки",resources:["вода","соль","финики"],notes:"Поселения стоят у колодцев."},
{id:"sahrad-coast",countryId:"sahrad",name:"Медное побережье",terrain:"жаркое сухое побережье",resources:["медь","рыба","стекло"],notes:"Порты связывают султанат с Варентом."},
{id:"varent-coast",countryId:"varent",name:"Западные гавани",terrain:"заливы и острова",resources:["рыба","корабельный лес"],notes:"Главные морские пути."},
{id:"tharvek-range",countryId:"tharvek",name:"Высокий хребет",terrain:"горы и перевалы",resources:["железо","олово","камень"],notes:"Перевалы закрываются снегом."},
{id:"elyndor-forest",countryId:"elyndor",name:"Старые леса",terrain:"леса и озёра",resources:["древесина","травы","меха"],notes:"Священные рощи."},
{id:"kharum-delta",countryId:"kharum",name:"Великая дельта",terrain:"жаркие влажные равнины",resources:["рис","хлопок","сахар"],notes:"Каналы и плотная сеть городов."}
];
export const MAP_NODES:MapNode[]=[
{id:"koronholm",name:"Коронхольм",countryId:"estran",regionId:"estran-heart",kind:"capital",x:30,y:37,populationBand:"large",climate:"temperate",tags:["двор","суд","монетный двор"]},
{id:"roven",name:"Ровен",countryId:"estran",regionId:"estran-heart",kind:"city",x:38,y:47,populationBand:"medium",climate:"temperate",tags:["торговля","река Лир"]},
{id:"northwatch",name:"Нортвотч",countryId:"estran",regionId:"estran-north",kind:"fort",x:27,y:24,populationBand:"small",climate:"cold",tags:["гарнизон","рудники"]},
{id:"millford",name:"Миллфорд",countryId:"estran",regionId:"estran-heart",kind:"town",x:33,y:56,populationBand:"small",climate:"temperate",tags:["мельницы","зерно"]},
{id:"qadira",name:"Кадира",countryId:"sahrad",regionId:"sahrad-oasis",kind:"capital",x:44,y:83,populationBand:"large",climate:"hot-arid",tags:["султанский двор","оазис"]},
{id:"safra",name:"Сафра",countryId:"sahrad",regionId:"sahrad-oasis",kind:"desert-stop",x:35,y:89,populationBand:"small",climate:"hot-arid",tags:["караван-сарай","колодец"]},
{id:"miraj",name:"Мираж",countryId:"sahrad",regionId:"sahrad-coast",kind:"port",x:55,y:72,populationBand:"medium",climate:"hot-arid",tags:["порт","медь"]},
{id:"varentport",name:"Варенпорт",countryId:"varent",regionId:"varent-coast",kind:"capital",x:64,y:37,populationBand:"large",climate:"temperate",tags:["совет Лиги","морское право","главная гавань"]},
{id:"merovar",name:"Меровар",countryId:"varent",regionId:"varent-coast",kind:"city",x:73,y:29,populationBand:"large",climate:"temperate",tags:["банки","торговые палаты","финансовые дома"]},
{id:"bluehaven",name:"Синяя Гавань",countryId:"varent",regionId:"varent-coast",kind:"port",x:83,y:19,populationBand:"medium",climate:"temperate",tags:["моряки","контрабанда"]},
{id:"dravorn",name:"Драворн",countryId:"tharvek",regionId:"tharvek-range",kind:"capital",x:87,y:47,populationBand:"medium",climate:"mountain",tags:["княжеский конклав"]},
{id:"ironpass",name:"Железный Перевал",countryId:"tharvek",regionId:"tharvek-range",kind:"fort",x:78,y:43,populationBand:"small",climate:"mountain",tags:["застава","рудники"]},
{id:"lethariel",name:"Летариэль",countryId:"elyndor",regionId:"elyndor-forest",kind:"capital",x:10,y:32,populationBand:"medium",climate:"cold",tags:["родовые советы","озёра"]},
{id:"willowmere",name:"Ивовый Предел",countryId:"elyndor",regionId:"elyndor-forest",kind:"village",x:13,y:44,populationBand:"small",climate:"cold",tags:["священная роща"]},
{id:"har-kadar",name:"Хар-Кадар",countryId:"kharum",regionId:"kharum-delta",kind:"capital",x:87,y:87,populationBand:"metropolis",climate:"hot-humid",tags:["императорский двор","главные каналы","имперский совет"]},
{id:"azrakar",name:"Азракар",countryId:"kharum",regionId:"kharum-delta",kind:"city",x:74,y:82,populationBand:"large",climate:"hot-humid",tags:["верхний архив","писцовые школы","реестры"]},
{id:"namar",name:"Намар",countryId:"kharum",regionId:"kharum-delta",kind:"city",x:81,y:75,populationBand:"large",climate:"hot-humid",tags:["рисовые рынки","текстиль"]},
{id:"sunspire",name:"Солнечный Шпиль",countryId:"kharum",regionId:"kharum-delta",kind:"monastery",x:95,y:78,populationBand:"small",climate:"hot-humid",tags:["храмовая школа","архивы"]}
 ,
{id:"westmere",name:"Вестмер",countryId:"estran",regionId:"estran-heart",kind:"town",x:44,y:40,populationBand:"small",climate:"temperate",tags:["переправа","зерновые амбары"]},
{id:"ashcombe",name:"Эшкомб",countryId:"estran",regionId:"estran-north",kind:"village",x:22,y:30,populationBand:"small",climate:"temperate",tags:["лесопилки","железная руда"]},
{id:"daryat",name:"Дарьят",countryId:"sahrad",regionId:"sahrad-oasis",kind:"town",x:53,y:80,populationBand:"medium",climate:"hot-arid",tags:["каналы","финиковые сады"]},
{id:"saffron-coast",name:"Шафрановый Порт",countryId:"sahrad",regionId:"sahrad-coast",kind:"port",x:35,y:71,populationBand:"small",climate:"hot-arid",tags:["красители","рыбацкие артели"]},
{id:"tidewatch",name:"Тайд-вотч",countryId:"varent",regionId:"varent-coast",kind:"port",x:91,y:12,populationBand:"medium",climate:"temperate",tags:["маяки","верфи"]},
{id:"saltmere",name:"Солёный Мер",countryId:"varent",regionId:"varent-coast",kind:"town",x:58,y:28,populationBand:"small",climate:"temperate",tags:["соляные склады","рыбный рынок"]},
{id:"stonebridge",name:"Каменный Мост",countryId:"tharvek",regionId:"tharvek-range",kind:"town",x:90,y:58,populationBand:"small",climate:"mountain",tags:["мост через ущелье","постоялый двор"]},
{id:"deepforge",name:"Глубокая Кузня",countryId:"tharvek",regionId:"tharvek-range",kind:"mining-town",x:95,y:38,populationBand:"small",climate:"mountain",tags:["рудники","плавильни"]},
{id:"mossford",name:"Моховый Брод",countryId:"elyndor",regionId:"elyndor-forest",kind:"village",x:6,y:22,populationBand:"small",climate:"cold",tags:["брод","травники"]},
{id:"lake-ward",name:"Озерный Дозор",countryId:"elyndor",regionId:"elyndor-forest",kind:"town",x:16,y:25,populationBand:"small",climate:"cold",tags:["рыбацкие пристани","лодочные мастера"]},
{id:"reedhaven",name:"Тростниковая Гавань",countryId:"kharum",regionId:"kharum-delta",kind:"port",x:73,y:93,populationBand:"medium",climate:"hot-humid",tags:["речные баржи","рисовые склады"]},
{id:"ivory-gate",name:"Врата Слоновой Кости",countryId:"kharum",regionId:"kharum-delta",kind:"town",x:93,y:94,populationBand:"medium",climate:"hot-humid",tags:["таможня","имперская дорога"]}
];
/**
 * Дороги и пути (0.18.0). Дни не задаются вручную: они считаются из расстояния на карте и способа пути,
 * поэтому карта и время всегда сходятся. 1 единица карты = KM_PER_MAP_UNIT км.
 * Скорости: пешком или повозкой по дороге, горным перевалом, вниз по реке, морем под парусом.
 * Это проектные значения, не канон.
 */
export const KM_PER_MAP_UNIT = 10;
export const KM_PER_DAY: Record<Route["mode"], number> = { road: 30, "mountain-pass": 15, river: 45, sea: 100 };
export const routeKm = (from: MapNode, to: MapNode) => Math.round(Math.hypot(from.x - to.x, from.y - to.y) * KM_PER_MAP_UNIT);
type RouteSpec = Omit<Route, "days">;
const ROUTE_SPECS: RouteSpec[] = [
// Эстран: сердце, север, переправы на Лире.
{from:"koronholm",to:"roven",mode:"road",danger:"low"},{from:"roven",to:"millford",mode:"road",danger:"low"},
{from:"roven",to:"westmere",mode:"road",danger:"low"},{from:"westmere",to:"koronholm",mode:"road",danger:"low"},
{from:"koronholm",to:"northwatch",mode:"road",danger:"moderate",seasonalClosure:"сильные снегопады"},
{from:"northwatch",to:"ashcombe",mode:"road",danger:"moderate",seasonalClosure:"сильные снегопады"},{from:"ashcombe",to:"koronholm",mode:"road",danger:"moderate"},
// Через внутреннее море Лиар: из Ровена вниз по Лиру и морем.
{from:"roven",to:"varentport",mode:"sea",danger:"moderate"},{from:"roven",to:"miraj",mode:"sea",danger:"moderate"},
// Варент на северо-востоке.
{from:"westmere",to:"saltmere",mode:"road",danger:"moderate"},{from:"saltmere",to:"varentport",mode:"road",danger:"low"},
{from:"varentport",to:"merovar",mode:"road",danger:"low"},{from:"merovar",to:"bluehaven",mode:"road",danger:"low"},{from:"bluehaven",to:"tidewatch",mode:"sea",danger:"moderate"},
// Тарвек на востоке: горы и перевалы.
{from:"varentport",to:"ironpass",mode:"mountain-pass",danger:"high",seasonalClosure:"зимой перевал закрыт"},{from:"ironpass",to:"dravorn",mode:"mountain-pass",danger:"high",seasonalClosure:"зимнее закрытие перевалов"},
{from:"dravorn",to:"deepforge",mode:"road",danger:"moderate"},{from:"dravorn",to:"stonebridge",mode:"mountain-pass",danger:"moderate",seasonalClosure:"снегопады и лавинная опасность"},
// Элиндор на западе: побережье и леса.
{from:"koronholm",to:"lethariel",mode:"road",danger:"high"},{from:"lethariel",to:"willowmere",mode:"road",danger:"low"},
{from:"lethariel",to:"mossford",mode:"road",danger:"low"},{from:"mossford",to:"lake-ward",mode:"river",danger:"moderate"},
// Сахрад на юге: южный берег Лиара и оазисы.
{from:"millford",to:"saffron-coast",mode:"road",danger:"moderate"},{from:"saffron-coast",to:"qadira",mode:"road",danger:"high"},
{from:"miraj",to:"daryat",mode:"road",danger:"moderate"},{from:"daryat",to:"qadira",mode:"road",danger:"moderate"},{from:"qadira",to:"safra",mode:"road",danger:"high"},
// Кхарум на дальнем юго-востоке: караваны и дельта.
{from:"daryat",to:"azrakar",mode:"road",danger:"high"},{from:"stonebridge",to:"namar",mode:"road",danger:"high"},
{from:"azrakar",to:"namar",mode:"river",danger:"moderate"},{from:"namar",to:"har-kadar",mode:"river",danger:"low"},
{from:"har-kadar",to:"sunspire",mode:"road",danger:"moderate"},{from:"har-kadar",to:"reedhaven",mode:"river",danger:"low"},{from:"reedhaven",to:"ivory-gate",mode:"road",danger:"moderate"}
];
export const ROUTES:Route[]=ROUTE_SPECS.map(spec=>{
  const a=MAP_NODES.find(n=>n.id===spec.from)!, b=MAP_NODES.find(n=>n.id===spec.to)!;
  return {...spec,days:Math.max(1,Math.ceil(routeKm(a,b)/KM_PER_DAY[spec.mode]))};
});

/** Условные контуры государств для схематической карты Ардана (координаты 0–100). */
export interface CountryShape { countryId: string; points: Array<[number, number]> }
export const COUNTRY_SHAPES: CountryShape[] = [
 {countryId:"estran",points:[[18,26],[30,18],[46,30],[50,38],[44,46],[40,52],[38,62],[26,62],[18,50]]},
 {countryId:"varent",points:[[50,22],[66,10],[86,6],[96,10],[92,24],[80,34],[70,40],[60,40],[50,34]]},
 {countryId:"tharvek",points:[[72,40],[84,32],[98,34],[98,62],[90,66],[78,62],[72,52]]},
 {countryId:"elyndor",points:[[2,18],[14,14],[20,22],[18,34],[16,50],[6,52],[2,40]]},
 {countryId:"sahrad",points:[[26,66],[40,64],[50,70],[60,72],[66,82],[60,94],[38,96],[24,86]]},
 {countryId:"kharum",points:[[66,76],[78,68],[92,70],[99,80],[99,98],[70,98],[64,88]]}
];

/** Моря и реки для рисованной карты (0.18.0): внутреннее море Лиар по Библии, Открытое море на западе, река Лир через Ровен. */
export interface MapWater { id: string; name: string; kind: "sea" | "river"; points: Array<[number, number]> }
export const MAP_WATERS: MapWater[] = [
 {id:"liar",name:"море Лиар",kind:"sea",points:[[44,48],[52,40],[62,42],[70,48],[72,58],[66,68],[54,68],[44,62],[40,56]]},
 {id:"open-sea",name:"Открытое море",kind:"sea",points:[[0,0],[2,0],[2,100],[0,100]]},
 {id:"lir",name:"река Лир",kind:"river",points:[[22,36],[28,41],[34,44],[38,47],[42,52]]}
];

export const routesFrom=(id:string)=>ROUTES.filter(r=>r.from===id||r.to===id);
