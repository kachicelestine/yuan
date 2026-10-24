// Fixture data for the design phase. Every name, price and count is illustrative.
import { avatar, square } from "@/lib/images";
import type { Seller } from "@/lib/types";

export const sellers: Record<string, Seller> = {
  sunvolt: { id: "sunvolt", name: "Sunvolt Energy", kind: "Factory", city: "Changzhou, Jiangsu", avatar: avatar("1544168190-79c17527004f"), verified: true, audited: "Aug 2026", years: 11 },
  voltgrid: { id: "voltgrid", name: "Voltgrid Power", kind: "Factory", city: "Bao'an, Shenzhen", avatar: square("1589793463357-5fb813435467"), verified: true, audited: "Aug 2026", years: 9 },
  chargelink: { id: "chargelink", name: "ChargeLink Tech", kind: "Factory", city: "Ningbo, Zhejiang", avatar: square("1766507680004-1c71007aefe5", 0.55), verified: true, audited: "Jun 2026", years: 6 },
  swift: { id: "swift", name: "Swift Mobility", kind: "Factory", city: "Tianjin", avatar: square("1760386128692-81476422e599"), verified: true, audited: "Jul 2026", years: 8 },
  evdesk: { id: "evdesk", name: "EV Export Desk", kind: "Exporter", city: "Hefei, Anhui", avatar: avatar("1624395213043-fa2e123b2656"), verified: true, years: 5 },
  sztech: { id: "sztech", name: "SZ Tech Lab", kind: "Brand", city: "Bao'an, Shenzhen", avatar: avatar("1681097561932-36d0df02b379"), verified: true, years: 4 },
  makerworks: { id: "makerworks", name: "MakerWorks", kind: "Brand", city: "Nanshan, Shenzhen", avatar: square("1758435170505-e9b2772348c1"), verified: true, years: 7 },
  mei: { id: "mei", name: "Mei Atelier", kind: "Maker", city: "Suzhou, Jiangsu", avatar: avatar("1679032658892-e3bb9e057834", { fx: 0.5, fy: 0.27, zoom: 3 }), verified: true, years: 6 },
  glowlab: { id: "glowlab", name: "Glow Lab", kind: "Brand", city: "Guangzhou", avatar: avatar("1592150282082-37698debe277", { fx: 0.3, fy: 0.37, zoom: 1.9 }), verified: true, years: 3 },
  hustudio: { id: "hustudio", name: "Hu Studio", kind: "Maker", city: "Jingdezhen, Jiangxi", avatar: avatar("1758600587815-b654d1405e83"), verified: true, years: 28 },
  jintea: { id: "jintea", name: "Jin Tea House", kind: "Maker", city: "Hangzhou, Zhejiang", avatar: avatar("1600481176431-47ad2ab2745d"), verified: true, years: 15 },
  pals: { id: "pals", name: "Pop and Pals", kind: "Brand", city: "Dongguan, Guangdong", avatar: square("1758348620526-f24ce6f67826", 0.45), verified: true, years: 5 },
  lumen: { id: "lumen", name: "Lumen Home", kind: "Maker", city: "Zhongshan, Guangdong", avatar: square("1540932239986-30128078f3c5", 0.5, 0.35), verified: true, years: 12 },
  stride: { id: "stride", name: "Stride Lab", kind: "Brand", city: "Jinjiang, Fujian", avatar: square("1560769629-975ec94e6a86"), verified: true, years: 9 },
  breeze: { id: "breeze", name: "Breeze Turbines", kind: "Factory", city: "Yangzhou, Jiangsu", avatar: square("1773656590225-4caf59cac2b0"), verified: true, audited: "Sep 2026", years: 14 },
  helio: { id: "helio", name: "HelioGrid", kind: "Factory", city: "Ningbo, Zhejiang", avatar: square("1780445392417-68b9dccc45f2", 0.8, 0.5), verified: true, audited: "Jul 2026", years: 10 },
  powercell: { id: "powercell", name: "Zhuhai PowerCell", kind: "Factory", city: "Zhuhai, Guangdong", avatar: square("1566554738544-d962991c3fee"), verified: true, audited: "Aug 2026", years: 8 },
  lumo: { id: "lumo", name: "Lumo Visual", kind: "Brand", city: "Longhua, Shenzhen", avatar: square("1637656367774-d5e65ace6290"), verified: true, years: 5 },
  cleanbot: { id: "cleanbot", name: "Cleanbot Robotics", kind: "Brand", city: "Suzhou, Jiangsu", avatar: square("1558317374-24793bc9f2fb", 0.7), verified: true, years: 6 },
  streetlab: { id: "streetlab", name: "Canton Street Lab", kind: "Brand", city: "Guangzhou", avatar: avatar("1780566036282-e0845b9e4efe"), verified: true, years: 4 },
  baigou: { id: "baigou", name: "Baigou Bag Works", kind: "Factory", city: "Baigou, Hebei", avatar: square("1598532163257-ae3c6b2524b6"), verified: true, audited: "Aug 2026", years: 18 },
  lantian: { id: "lantian", name: "Lantian Jade Studio", kind: "Maker", city: "Xi'an, Shaanxi", avatar: square("1767043004223-b2ccbefd98e9"), verified: true, years: 22 },
  miao: { id: "miao", name: "Miao Silver House", kind: "Maker", city: "Kaili, Guizhou", avatar: avatar("1781450951227-21372c89db8c"), verified: true, years: 19 },
  hzsilk: { id: "hzsilk", name: "Hangzhou Silk Mill", kind: "Factory", city: "Hangzhou, Zhejiang", avatar: square("1518893063132-36e46dbe2428"), verified: true, audited: "Jun 2026", years: 31 },
  yiwu: { id: "yiwu", name: "Yiwu Lantern Works", kind: "Factory", city: "Yiwu, Zhejiang", avatar: square("1758184776092-4a2766d6a8d3"), verified: true, audited: "Sep 2026", years: 12 },
};

