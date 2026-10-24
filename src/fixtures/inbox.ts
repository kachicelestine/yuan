// Fixture data for the design phase. Seller messages are written in Chinese and shown
// translated, the way the real chat will work.
import { avatar, square } from "@/lib/images";
import type { Activity, Thread } from "@/lib/types";

export const threads: Thread[] = [
  {
    sellerId: "voltgrid",
    unread: 2,
    messages: [
      { id: "m1", from: "me", text: "Hi! Is the 3 kWh power station in stock in graphite? I'm in Lagos.", at: "10:02" },
      { id: "m2", from: "seller", text: "Hi! Yes, the 3 kWh graphite is in stock and can leave Shenzhen tomorrow.", original: "您好！3 kWh 石墨灰有现货，明天就能从深圳发货。", at: "10:05" },
      { id: "m3", from: "seller", text: "It takes about 9–12 days to Lagos, and duties are already included in the price you see.", original: "到拉各斯大约 9–12 天，您看到的价格已经包含关税。", at: "10:05" },
      { id: "m4", from: "seller", product: "power-station-2kwh", text: "Here's the listing. Pick 3 kWh in the options.", original: "这是商品链接，选项里选 3 kWh 就可以。", at: "10:06" },
      { id: "m5", from: "seller", image: square("1678775882496-59554c53e32e", 0.45, 0.6), text: "A photo from today's packing line.", original: "这是今天包装线上拍的实物图。", at: "10:07" },
    ],
  },
  {
    sellerId: "mei",
    unread: 1,
    messages: [
      { id: "m1", from: "me", text: "I'd like the peony qipao for a wedding on Dec 12. Bust 86, waist 68, hips 92.", at: "Yesterday" },
      { id: "m2", from: "seller", text: "Congratulations! We'll cut it to those measurements and send you a fitting video before we sew the lining.", original: "恭喜！我们会按这个尺寸裁剪，缝里衬之前先给您发试穿视频。", at: "Yesterday" },
      { id: "m3", from: "seller", text: "It will reach you by Dec 1, in time for any small adjustments.", original: "12 月 1 日前送到，来得及做小调整。", at: "Yesterday" },
    ],
  },
  {
    sellerId: "streetlab",
    unread: 0,
    messages: [
      { id: "m1", from: "me", text: "Can you puff-print our club logo on 60 hoodies, mixed sizes?", at: "Mon" },
      { id: "m2", from: "seller", text: "Yes! Send the logo as a vector file and we'll reply with a digital proof within a day.", original: "可以！请发矢量格式的 logo，我们一天内回复数码样稿。", at: "Mon" },
      { id: "m3", from: "me", text: "Sent. Black hoodies, white logo.", at: "Mon" },
      { id: "m4", from: "seller", image: square("1768696082704-c4e5593d9f27", 0.5, 0.3), text: "Proof attached. 60 pieces is $22 each with the print.", original: "样稿已附上。60 件含印花每件 22 美元。", at: "Tue" },
    ],
  },
  {
    sellerId: "sunvolt",
    unread: 0,
    messages: [
      { id: "m1", from: "me", text: "Do you sell mounting rails for 36 panels?", at: "Oct 18" },
      { id: "m2", from: "seller", text: "We do. We'll put rails and clamps on the same pallet so everything ships as one.", original: "有的。导轨和压块会和面板放在同一个托盘上，一起发货。", at: "Oct 18" },
    ],
  },
];

/** What the seller says next, by what you wrote. Keywords cover the common questions. */
export const autoReplies: { match: RegExp; text: string; original: string }[] = [
  { match: /stock|available|have/i, text: "Yes, it's in stock and ships within 48 hours.", original: "有现货，48 小时内发货。" },
  { match: /price|discount|cheaper|best|deal/i, text: "For 10 or more we can do the next tier price. How many do you need?", original: "10 件以上可以给下一档价格。您需要多少？" },
  { match: /ship|fast|express|deliver|when/i, text: "Express air takes 3–5 days. I can switch your order to express at checkout.", original: "空运快递 3–5 天。结账时可以改成快递。" },
  { match: /video|photo|picture|real/i, text: "Sure, I'll film it on the line this afternoon and send it here.", original: "好的，今天下午在产线上拍给您。" },
  { match: /logo|custom|print|oem/i, text: "Custom logos start at 50 pieces. Send the file and we'll make a proof.", original: "定制 logo 50 件起。发文件过来，我们做样稿。" },
];

export const fallbackReply = { text: "Got it, we'll check and reply here shortly.", original: "收到，我们核实后马上回复您。" };

export const quickReplies = ["Is it in stock?", "Best price for 10?", "Can it ship faster?", "Send me a real video"];

export const activity: Activity[] = [
  { id: "x1", kind: "price", title: "Price drop on something you saved", body: "20,000 mAh power bank is now $26, down from $29.", at: "12 min", image: square("1566554738544-d962991c3fee"), href: "/p/power-bank-20k", unread: true, group: "Today" },
  { id: "x2", kind: "live", title: "Glow Lab is live", body: "Ava is swatching the velvet lip set. 12.4K watching.", at: "25 min", image: avatar("1592150282082-37698debe277", { fx: 0.3, fy: 0.37, zoom: 1.9 }), href: "/live", unread: true, group: "Today" },
  { id: "x3", kind: "reply", title: "Mei Atelier replied to your comment", body: "“Bust, waist and hips. We send a fitting video before we cut.”", at: "1 h", image: avatar("1679032658892-e3bb9e057834", { fx: 0.5, fy: 0.27, zoom: 3 }), href: "/inbox/mei", unread: true, group: "Today" },
  { id: "x4", kind: "order", title: "Your order left Shenzhen", body: "On a flight to Lagos. Customs clearance is already paid.", at: "3 h", image: square("1678182451047-196f22a4143e"), href: "/orders/demo", group: "Today" },
  { id: "x5", kind: "team", title: "Your team buy is full", body: "3 of 3 joined. West Lake Longjing is yours at $18.", at: "Yesterday", image: square("1531969179221-3946e6b5a5e7", 0.45, 0.4), href: "/drops", group: "Earlier" },
  { id: "x6", kind: "coins", title: "+200 coins", body: "Thanks for reviewing your cloud-knit trainers.", at: "Yesterday", href: "/rewards", group: "Earlier" },
  { id: "x7", kind: "restock", title: "Back in stock: Sand colour", body: "Voltgrid restocked the power station in Sand.", at: "Oct 20", image: square("1678775882799-2fba7042e7da"), href: "/p/power-station-2kwh", group: "Earlier" },
];
