// Fixture data for the design phase. Reviews and answers are illustrative.
import { avatar, square } from "@/lib/images";
import type { Question, Review } from "@/lib/types";
import { people } from "./people";

const tomi = avatar("1600481176431-47ad2ab2745d");
const ana = avatar("1758600587839-56ba05596c69");

export const reviews: Review[] = [
  { id: "r1", productSlug: "power-station-2kwh", author: "Kofi A.", avatar: people.kofi, country: "GH", rating: 5, text: "Runs our fridge, the router and two fans through every power cut in Accra. Charges from two panels by early afternoon. The app shows exactly what is drawing power.", photos: [square("1678775882496-59554c53e32e", 0.45, 0.6)], option: "3 kWh · Graphite", date: "Oct 12", helpful: 214, sellerReply: "Thank you Kofi. Tip: set the charge limit to 90% in the app for even longer cell life." },
  { id: "r2", productSlug: "power-station-2kwh", author: "Lin O.", avatar: people.lin, country: "AU", rating: 5, text: "Took it on a two-week van trip. Quiet, honest battery percentage, and the 2,400 W output ran a kettle without complaint.", photos: [square("1678775883148-6642c67015f5", 0.45, 0.55), square("1678775882799-2fba7042e7da")], option: "2 kWh · Sand", date: "Oct 3", helpful: 167 },
  { id: "r3", productSlug: "power-station-2kwh", author: "Amara O.", avatar: people.amara, country: "NG", rating: 4, text: "Excellent unit and duties were already paid, so nothing to sort out at the door. One star off because it is heavy for one person to carry upstairs.", option: "2 kWh · Graphite", date: "Sep 28", helpful: 98 },
  { id: "r4", productSlug: "power-station-2kwh", author: "Moussa D.", avatar: tomi, country: "CI", rating: 5, text: "Arrived in Abidjan in 12 days, well packed. It powers my small shop all evening.", translatedFrom: "French", original: "Arrivé à Abidjan en 12 jours, bien emballé. Il alimente ma petite boutique toute la soirée.", option: "1 kWh · Olive", date: "Sep 21", helpful: 61 },

  { id: "r5", productSlug: "solar-panel-450w-bifacial", author: "Kofi A.", avatar: people.kofi, country: "GH", rating: 5, text: "Thirty-six panels on one pallet, not one scratch. The back side really adds yield on our white roof.", photos: [square("1648135327756-b606e2eb8caa"), square("1780445392792-556e5609c5ab")], option: "All black", date: "Oct 9", helpful: 189 },
  { id: "r6", productSlug: "solar-panel-450w-bifacial", author: "Rafael S.", avatar: people.ravi, country: "BR", rating: 5, text: "Better price than the local distributor even with ICMS included. Installer said the frames are solid.", translatedFrom: "Portuguese", original: "Preço melhor que o distribuidor local, mesmo com ICMS incluído. O instalador disse que as molduras são sólidas.", option: "Silver", date: "Sep 30", helpful: 77 },
  { id: "r7", productSlug: "solar-panel-450w-bifacial", author: "Jun W.", avatar: people.jun, country: "GB", rating: 4, text: "Good panels. Delivery took four days longer than the estimate, but tracking was clear the whole way.", option: "Silver", date: "Sep 18", helpful: 41 },

  { id: "r8", productSlug: "drone-mini-4k", author: "Kai B.", avatar: people.ravi, country: "IN", rating: 5, text: "Steady in a strong sea breeze and the 4K footage needs almost no editing. Under 250 g, so no paperwork here.", photos: [square("1557343569-b1d5b655b7cb")], option: "Fly More kit", date: "Oct 14", helpful: 302 },
  { id: "r9", productSlug: "drone-mini-4k", author: "Mia L.", avatar: people.mia, country: "DE", rating: 4, text: "Love it, but buy the Fly More kit: one battery is never enough on a hike.", option: "Drone + 2 batteries", date: "Oct 1", helpful: 88 },

  { id: "r10", productSlug: "qipao-silk-made-to-measure", author: "Sora K.", avatar: people.sora, country: "US", rating: 5, text: "They sent a fitting video before cutting, and the dress fits like it was made on me. Because it was.", photos: [square("1679032753853-27a8444b2dbe", 0.5, 0.4), square("1788196045643-77282a69c1fa", 0.5, 0.4)], option: "Custom", date: "Oct 6", helpful: 412, sellerReply: "It was an honour to make it, Sora. Send us a photo from the wedding!" },
  { id: "r11", productSlug: "qipao-silk-made-to-measure", author: "Ana P.", avatar: ana, country: "MX", rating: 5, text: "The silk is heavier and softer than I expected. The embroidery is perfect.", translatedFrom: "Spanish", original: "La seda es más pesada y suave de lo que esperaba. El bordado es perfecto.", option: "M", date: "Sep 25", helpful: 133 },

  { id: "r12", productSlug: "power-bank-20k", author: "Wanjiru M.", avatar: people.amara, country: "KE", rating: 5, text: "Charges my laptop at full speed and my phone four times. Paid in USDC, arrived in Nairobi in nine days.", translatedFrom: "Swahili", original: "Inachaji laptop yangu kwa kasi kamili na simu mara nne. Nililipa kwa USDC, ilifika Nairobi kwa siku tisa.", photos: [square("1566554738544-d962991c3fee")], option: "Lagoon", date: "Oct 15", helpful: 256 },
  { id: "r13", productSlug: "power-bank-20k", author: "Jun W.", avatar: people.jun, country: "GB", rating: 4, text: "Solid build, accurate display. A bit heavy for a jeans pocket.", option: "Titanium", date: "Oct 2", helpful: 39 },

  { id: "r14", productSlug: "hoodie-heavyweight", author: "Kofi A.", avatar: people.kofi, country: "GH", rating: 5, text: "Ordered 60 with our club logo in puff print. Thick, boxy and it kept its shape after ten washes.", photos: [square("1768696082704-c4e5593d9f27", 0.5, 0.3)], option: "L · Ink", date: "Oct 11", helpful: 198 },
  { id: "r15", productSlug: "hoodie-heavyweight", author: "Sora K.", avatar: people.sora, country: "US", rating: 5, text: "Twice as thick as the hoodies I used to buy for twice the price.", option: "M · Bone", date: "Oct 4", helpful: 121 },

  { id: "r16", productSlug: "jade-bangle-lantian", author: "Mia L.", avatar: people.mia, country: "DE", rating: 5, text: "The certificate matched the stone and the colour is deeper in person. Size guide was spot on.", photos: [square("1767043004223-b2ccbefd98e9")], option: "56 mm", date: "Oct 8", helpful: 92 },

  { id: "r17", productSlug: "balcony-solar-800w", author: "Mia L.", avatar: people.mia, country: "DE", rating: 5, text: "Plugged it in, connected the app, done. Our meter runs slower every sunny afternoon.", photos: [square("1655300256335-beef51a914fe")], date: "Oct 13", helpful: 143 },
  { id: "r18", productSlug: "balcony-solar-800w", author: "Jun W.", avatar: people.jun, country: "GB", rating: 4, text: "Works well, but check your balcony faces south: ours is west and makes about 60% of the claimed output.", date: "Oct 5", helpful: 117 },

  { id: "r19", productSlug: "robot-vacuum-lidar", author: "Ana P.", avatar: ana, country: "MX", rating: 5, text: "The map is perfect and it never gets stuck on the rug fringes. Three cats, zero fur on the floor.", translatedFrom: "Spanish", original: "El mapa es perfecto y nunca se atora en los flecos de la alfombra. Tres gatos, cero pelo en el piso.", option: "Pearl", date: "Oct 10", helpful: 175 },
  { id: "r20", productSlug: "e-moto-fat-tyre", author: "Ravi K.", avatar: people.ravi, country: "IN", rating: 5, text: "Street-legal kit was in the box, as promised. 75 km on the big pack with hills.", photos: [square("1761169331195-e079523673c5", 0.5, 0.55)], option: "48 V 30 Ah", date: "Sep 29", helpful: 84 },
];

export const questions: Question[] = [
  { id: "q1", productSlug: "power-station-2kwh", question: "Can it charge while powering my fridge (pass-through)?", answer: "Yes. It switches to grid or solar power in under 10 ms and keeps running your fridge while it charges.", answeredBy: "seller", asker: "Amara O.", votes: 88 },
  { id: "q2", productSlug: "power-station-2kwh", question: "Which plugs does it ship with for Nigeria?", answer: "We ship UK-type sockets for Nigeria and Ghana, and include a universal adapter.", answeredBy: "seller", asker: "Tobi E.", votes: 41 },
  { id: "q3", productSlug: "power-station-2kwh", question: "How loud is it under full load?", answer: "Quieter than my laptop fan unless you run the kettle. Then it hums.", answeredBy: "buyer", asker: "Lin O.", votes: 27 },
  { id: "q4", productSlug: "solar-panel-450w-bifacial", question: "Do you sell mounting rails too?", answer: "Yes, ask in chat and we'll add rails and clamps to the same pallet so it ships as one.", answeredBy: "seller", asker: "Kofi A.", votes: 52 },
  { id: "q5", productSlug: "drone-mini-4k", question: "Is it legal to fly without registration in the EU?", answer: "At 249 g it falls in the A1 subcategory. Rules vary by country, so check your aviation authority's site.", answeredBy: "seller", asker: "Mia L.", votes: 64 },
  { id: "q6", productSlug: "power-bank-20k", question: "Is it allowed in hand luggage?", answer: "Yes. At 74 Wh it is under the 100 Wh airline limit.", answeredBy: "seller", asker: "Jun W.", votes: 73 },
  { id: "q7", productSlug: "hoodie-heavyweight", question: "What's the minimum for a custom print?", answer: "50 pieces, mixed sizes allowed. We send a digital proof within a day.", answeredBy: "seller", asker: "Kofi A.", votes: 59 },
  { id: "q8", productSlug: "qipao-silk-made-to-measure", question: "What if it doesn't fit?", answer: "Free adjustment within 30 days. Send it back and we'll re-tailor it.", answeredBy: "seller", asker: "Sora K.", votes: 47 },
];

