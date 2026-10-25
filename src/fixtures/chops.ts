// Fixture data for the design phase. A chop has a fixed target and a fixed number of
// equal cuts, both shown up front; neither ever changes once the chop starts.
import { people } from "@/fixtures/people";
import type { Chop } from "@/lib/types";

export const chops: Chop[] = [
  {
    id: "earbuds",
    slug: "earbuds-anc",
    target: 9,
    cuts: 8,
    hoursLeft: 17.5,
    friends: [
      { name: "Amara", avatar: people.amara },
      { name: "Kofi", avatar: people.kofi },
      { name: "Mia", avatar: people.mia },
    ],
  },
  {
    id: "keyboard",
    slug: "keyboard-75-retro",
    target: 29,
    cuts: 6,
    hoursLeft: 22,
    friends: [{ name: "Jun", avatar: people.jun }],
  },
  {
    id: "lamp",
    slug: "lamp-brass-pendant",
    target: 15,
    cuts: 5,
    hoursLeft: 9,
    friends: [
      { name: "Lin", avatar: people.lin },
      { name: "Ravi", avatar: people.ravi },
      { name: "Sora", avatar: people.sora },
    ],
  },
];
