// Fixture data for the design phase. Specialities are real; seller lists are our fixtures.
import { photo } from "@/lib/images";
import type { FactoryTown } from "@/lib/types";

const wide = (id: string, fx = 0.5, fy = 0.5) => photo(id, { ar: "4:3", fx, fy });

/** China's manufacturing clusters: shop by the town that makes it best. */
export const towns: FactoryTown[] = [
  { id: "shenzhen", name: "Shenzhen", province: "Guangdong", speciality: "Electronics, drones and batteries", fact: "Most of the world's consumer electronics pass through here.", image: wide("1612919914128-48ac089b951d"), sellerIds: ["sztech", "voltgrid", "makerworks", "lumo"], port: "Yantian" },
  { id: "yiwu", name: "Yiwu", province: "Zhejiang", speciality: "Small goods and festival decor", fact: "Home to the world's largest small-commodities market.", image: wide("1774979301475-bdbfe389ce72"), sellerIds: ["yiwu"], port: "Ningbo" },
  { id: "baigou", name: "Baigou", province: "Hebei", speciality: "Bags and luggage", fact: "Thousands of workshops make a third of China's bags.", image: wide("1768806470363-7c6193a29645"), sellerIds: ["baigou"], port: "Tianjin" },
  { id: "jingdezhen", name: "Jingdezhen", province: "Jiangxi", speciality: "Porcelain and enamel", fact: "The porcelain capital for over a thousand years.", image: wide("1723779234372-023dd09385ef"), sellerIds: ["hustudio"], port: "Shanghai" },
  { id: "jinjiang", name: "Jinjiang", province: "Fujian", speciality: "Trainers and sportswear", fact: "Makes shoes for half the world's sports brands.", image: wide("1560769629-975ec94e6a86"), sellerIds: ["stride"], port: "Xiamen" },
  { id: "changzhou", name: "Changzhou", province: "Jiangsu", speciality: "Solar modules", fact: "One of the biggest solar-panel clusters on earth.", image: wide("1641959166364-6c9b9898e804"), sellerIds: ["sunvolt"], port: "Shanghai" },
  { id: "hangzhou", name: "Hangzhou", province: "Zhejiang", speciality: "Silk and green tea", fact: "Silk has been woven here since the Song dynasty.", image: wide("1619043518800-7f14be467dca"), sellerIds: ["hzsilk", "jintea"], port: "Ningbo" },
  { id: "guangzhou", name: "Guangzhou", province: "Guangdong", speciality: "Fashion and beauty", fact: "The labs and cut-and-sew shops behind countless global labels.", image: wide("1745240261519-0b988d54d098", 0.5, 0.35), sellerIds: ["streetlab", "glowlab"], port: "Nansha" },
  { id: "suzhou", name: "Suzhou", province: "Jiangsu", speciality: "Embroidery and robotics", fact: "Silk embroidery and smart-home robots, side by side.", image: wide("1772785952443-cdf58994e444", 0.5, 0.4), sellerIds: ["mei", "cleanbot"], port: "Shanghai" },
  { id: "zhongshan", name: "Zhongshan", province: "Guangdong", speciality: "Lighting", fact: "Known simply as China's lighting town.", image: wide("1568482224714-7843360d588a", 0.5, 0.4), sellerIds: ["lumen"], port: "Nansha" },
];

