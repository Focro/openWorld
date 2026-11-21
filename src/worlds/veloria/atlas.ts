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
{id:"koronholm",name:"Коронхольм",countryId:"estran",regionId:"estran-heart",kind:"capital",x:48,y:35,populationBand:"large",climate:"temperate",tags:["двор","суд","монетный двор"]},
{id:"roven",name:"Ровен",countryId:"estran",regionId:"estran-heart",kind:"city",x:54,y:43,populationBand:"medium",climate:"temperate",tags:["торговля","река Лир"]},
{id:"northwatch",name:"Нортвотч",countryId:"estran",regionId:"estran-north",kind:"fort",x:43,y:22,populationBand:"small",climate:"cold",tags:["гарнизон","рудники"]},
{id:"millford",name:"Миллфорд",countryId:"estran",regionId:"estran-heart",kind:"town",x:59,y:53,populationBand:"small",climate:"temperate",tags:["мельницы","зерно"]},
{id:"qadira",name:"Кадира",countryId:"sahrad",regionId:"sahrad-oasis",kind:"capital",x:79,y:62,populationBand:"large",climate:"hot-arid",tags:["султанский двор","оазис"]},
{id:"safra",name:"Сафра",countryId:"sahrad",regionId:"sahrad-oasis",kind:"desert-stop",x:86,y:55,populationBand:"small",climate:"hot-arid",tags:["караван-сарай","колодец"]},
{id:"miraj",name:"Мираж",countryId:"sahrad",regionId:"sahrad-coast",kind:"port",x:91,y:68,populationBand:"medium",climate:"hot-arid",tags:["порт","медь"]},
{id:"varentport",name:"Варенпорт",countryId:"varent",regionId:"varent-coast",kind:"capital",x:15,y:47,populationBand:"large",climate:"temperate",tags:["совет Лиги","морское право","главная гавань"]},
{id:"merovar",name:"Меровар",countryId:"varent",regionId:"varent-coast",kind:"city",x:22,y:49,populationBand:"large",climate:"temperate",tags:["банки","торговые палаты","финансовые дома"]},
{id:"bluehaven",name:"Синяя Гавань",countryId:"varent",regionId:"varent-coast",kind:"port",x:13,y:58,populationBand:"medium",climate:"temperate",tags:["моряки","контрабанда"]},
{id:"dravorn",name:"Драворн",countryId:"tharvek",regionId:"tharvek-range",kind:"capital",x:40,y:8,populationBand:"medium",climate:"mountain",tags:["княжеский конклав"]},
{id:"ironpass",name:"Железный Перевал",countryId:"tharvek",regionId:"tharvek-range",kind:"fort",x:48,y:13,populationBand:"small",climate:"mountain",tags:["застава","рудники"]},
{id:"lethariel",name:"Летариэль",countryId:"elyndor",regionId:"elyndor-forest",kind:"capital",x:27,y:17,populationBand:"medium",climate:"cold",tags:["родовые советы","озёра"]},
{id:"willowmere",name:"Ивовый Предел",countryId:"elyndor",regionId:"elyndor-forest",kind:"village",x:19,y:24,populationBand:"small",climate:"cold",tags:["священная роща"]},
{id:"har-kadar",name:"Хар-Кадар",countryId:"kharum",regionId:"kharum-delta",kind:"capital",x:83,y:87,populationBand:"metropolis",climate:"hot-humid",tags:["императорский двор","главные каналы","имперский совет"]},
{id:"azrakar",name:"Азракар",countryId:"kharum",regionId:"kharum-delta",kind:"city",x:70,y:82,populationBand:"large",climate:"hot-humid",tags:["верхний архив","писцовые школы","реестры"]},
{id:"namar",name:"Намар",countryId:"kharum",regionId:"kharum-delta",kind:"city",x:76,y:77,populationBand:"large",climate:"hot-humid",tags:["рисовые рынки","текстиль"]},
{id:"sunspire",name:"Солнечный Шпиль",countryId:"kharum",regionId:"kharum-delta",kind:"monastery",x:91,y:80,populationBand:"small",climate:"hot-humid",tags:["храмовая школа","архивы"]}
 ,
{id:"westmere",name:"Вестмер",countryId:"estran",regionId:"estran-heart",kind:"town",x:61,y:39,populationBand:"small",climate:"temperate",tags:["переправа","зерновые амбары"]},
{id:"ashcombe",name:"Эшкомб",countryId:"estran",regionId:"estran-north",kind:"village",x:38,y:29,populationBand:"small",climate:"temperate",tags:["лесопилки","железная руда"]},
{id:"daryat",name:"Дарьят",countryId:"sahrad",regionId:"sahrad-oasis",kind:"town",x:72,y:57,populationBand:"medium",climate:"hot-arid",tags:["каналы","финиковые сады"]},
{id:"saffron-coast",name:"Шафрановый Порт",countryId:"sahrad",regionId:"sahrad-coast",kind:"port",x:96,y:74,populationBand:"small",climate:"hot-arid",tags:["красители","рыбацкие артели"]},
{id:"tidewatch",name:"Тайд-вотч",countryId:"varent",regionId:"varent-coast",kind:"port",x:7,y:43,populationBand:"medium",climate:"temperate",tags:["маяки","верфи"]},
{id:"saltmere",name:"Солёный Мер",countryId:"varent",regionId:"varent-coast",kind:"town",x:25,y:60,populationBand:"small",climate:"temperate",tags:["соляные склады","рыбный рынок"]},
{id:"stonebridge",name:"Каменный Мост",countryId:"tharvek",regionId:"tharvek-range",kind:"town",x:34,y:13,populationBand:"small",climate:"mountain",tags:["мост через ущелье","постоялый двор"]},
{id:"deepforge",name:"Глубокая Кузня",countryId:"tharvek",regionId:"tharvek-range",kind:"mining-town",x:53,y:5,populationBand:"small",climate:"mountain",tags:["рудники","плавильни"]},
{id:"mossford",name:"Моховый Брод",countryId:"elyndor",regionId:"elyndor-forest",kind:"village",x:14,y:13,populationBand:"small",climate:"cold",tags:["брод","травники"]},
{id:"lake-ward",name:"Озерный Дозор",countryId:"elyndor",regionId:"elyndor-forest",kind:"town",x:31,y:28,populationBand:"small",climate:"cold",tags:["рыбацкие пристани","лодочные мастера"]},
{id:"reedhaven",name:"Тростниковая Гавань",countryId:"kharum",regionId:"kharum-delta",kind:"port",x:65,y:91,populationBand:"medium",climate:"hot-humid",tags:["речные баржи","рисовые склады"]},
{id:"ivory-gate",name:"Врата Слоновой Кости",countryId:"kharum",regionId:"kharum-delta",kind:"town",x:94,y:91,populationBand:"medium",climate:"hot-humid",tags:["таможня","имперская дорога"]}
];
export const ROUTES:Route[]=[
{from:"koronholm",to:"roven",days:2,mode:"road",danger:"low"},{from:"roven",to:"millford",days:1,mode:"road",danger:"low"},
{from:"koronholm",to:"northwatch",days:4,mode:"road",danger:"moderate",seasonalClosure:"сильные снегопады"},
{from:"roven",to:"varentport",days:8,mode:"road",danger:"moderate"},{from:"varentport",to:"merovar",days:1,mode:"road",danger:"low"},{from:"merovar",to:"bluehaven",days:2,mode:"sea",danger:"moderate"},
{from:"roven",to:"dravorn",days:9,mode:"road",danger:"high",seasonalClosure:"зимнее закрытие перевалов"},
{from:"dravorn",to:"ironpass",days:2,mode:"mountain-pass",danger:"high",seasonalClosure:"зимой перевал закрыт"},
{from:"northwatch",to:"lethariel",days:7,mode:"road",danger:"high"},{from:"lethariel",to:"willowmere",days:2,mode:"road",danger:"low"},
{from:"merovar",to:"miraj",days:12,mode:"sea",danger:"moderate"},{from:"miraj",to:"qadira",days:3,mode:"road",danger:"high"},
{from:"qadira",to:"safra",days:4,mode:"road",danger:"high"},{from:"qadira",to:"har-kadar",days:18,mode:"sea",danger:"high"},{from:"har-kadar",to:"azrakar",days:3,mode:"river",danger:"moderate"},
{from:"azrakar",to:"namar",days:2,mode:"river",danger:"moderate"},{from:"har-kadar",to:"sunspire",days:5,mode:"road",danger:"moderate"},
{from:"roven",to:"westmere",days:2,mode:"road",danger:"low"},
{from:"westmere",to:"millford",days:1,mode:"road",danger:"low"},
{from:"northwatch",to:"ashcombe",days:2,mode:"road",danger:"moderate",seasonalClosure:"сильные снегопады"},
{from:"ashcombe",to:"koronholm",days:3,mode:"road",danger:"moderate"},
{from:"qadira",to:"daryat",days:2,mode:"road",danger:"moderate"},
{from:"daryat",to:"saffron-coast",days:3,mode:"road",danger:"high"},
{from:"varentport",to:"tidewatch",days:2,mode:"sea",danger:"moderate"},
{from:"tidewatch",to:"saltmere",days:2,mode:"road",danger:"low"},
{from:"dravorn",to:"stonebridge",days:2,mode:"mountain-pass",danger:"moderate",seasonalClosure:"снегопады и лавинная опасность"},
{from:"stonebridge",to:"deepforge",days:2,mode:"road",danger:"moderate"},
{from:"lethariel",to:"mossford",days:2,mode:"road",danger:"low"},
{from:"mossford",to:"lake-ward",days:2,mode:"river",danger:"moderate"},
{from:"har-kadar",to:"reedhaven",days:2,mode:"river",danger:"low"},
{from:"reedhaven",to:"ivory-gate",days:3,mode:"road",danger:"moderate"}
];

/** Условные контуры государств для схематической карты Ардана (координаты 0–100). */
export interface CountryShape { countryId: string; points: Array<[number, number]> }
export const COUNTRY_SHAPES: CountryShape[] = [
 {countryId:"varent",points:[[5,39],[15,34],[25,39],[28,49],[23,60],[12,63],[5,53]]},
 {countryId:"elyndor",points:[[12,8],[26,5],[36,13],[33,26],[24,32],[13,25]]},
 {countryId:"tharvek",points:[[34,2],[49,0],[58,8],[53,19],[43,21],[34,14]]},
 {countryId:"estran",points:[[36,25],[49,21],[63,31],[67,45],[59,58],[45,56],[35,44]]},
 {countryId:"sahrad",points:[[69,48],[83,43],[96,54],[98,69],[88,78],[74,73],[67,61]]},
 {countryId:"kharum",points:[[63,76],[76,70],[92,75],[99,88],[91,98],[73,97],[62,88]]}
];

export const routesFrom=(id:string)=>ROUTES.filter(r=>r.from===id||r.to===id);
