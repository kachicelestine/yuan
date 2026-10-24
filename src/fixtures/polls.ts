// Fixture data for the design phase. "This or that?" polls friends vote on before you buy.
import { people } from "@/fixtures/people";
import type { Poll } from "@/lib/types";

export const polls: Poll[] = [
  {
    id: "birthday-bag",
    by: "Amara",
    avatar: people.amara,
    question: "Birthday bag for my sister. Which one?",
    hoursLeft: 18,
    options: [
      { slug: "bag-red-shoulder", votes: 14, voters: [people.kofi, people.mia, people.lin] },
      { slug: "bag-structured-top-handle", votes: 9, voters: [people.ravi, people.sora] },
      { slug: "bag-sling-tech", votes: 4, voters: [people.jun] },
    ],
    comments: [
      { name: "Kofi", avatar: people.kofi, text: "The red one. She wears black every day, it'll pop.", pick: 0 },
      { name: "Ravi", avatar: people.ravi, text: "Top-handle looks more expensive than it is.", pick: 1 },
      { name: "Mia", avatar: people.mia, text: "Red, and get the matching lip set.", pick: 0 },
    ],
  },
  {
    id: "first-serum",
    by: "Lin",
    avatar: people.lin,
    question: "First serum for sensitive skin?",
    hoursLeft: 6,
    options: [
      { slug: "serum-niacinamide", votes: 21, voters: [people.mia, people.amara] },
      { slug: "serum-bakuchiol", votes: 25, voters: [people.sora, people.jun, people.kofi] },
    ],
    comments: [
      { name: "Sora", avatar: people.sora, text: "Bakuchiol. Gentle, and no purging for me.", pick: 1 },
      { name: "Amara", avatar: people.amara, text: "Niacinamide fixed my redness in two weeks.", pick: 0 },
    ],
  },
];
