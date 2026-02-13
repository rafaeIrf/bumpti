/**
 * Mock active users data for Apple reviewer bypass.
 * These fake users appear as "active at a place" ONLY for the reviewer account.
 * They correspond to fake4-fake10 seeded profiles that haven't matched with the reviewer.
 */
import type { ActiveUserAtPlace, ActiveUsersResponse, PresenceRecord } from "./api";

// Reviewer account emails for detection
export const REVIEWER_EMAILS = ["reviewer@bumpti.com", "reviewer_onboarding@bumpti.com"];

// Fake active users (fake4 through fake10) - those who haven't matched with reviewer
const MOCK_ACTIVE_USERS: ActiveUserAtPlace[] = [
  {
    user_id: "7d2151e1-d890-45e3-a9a6-963f6a99fee1",
    name: "Carlos",
    age: 27,
    bio: "Desenvolvedor de dia, chef de noite 👨‍💻🍳",
    intentions: ["friendship", "networking"],
    interests: ["tech_innovation", "coffee_lovers", "street_food"],
    photos: ["https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=800&fit=crop&crop=face"],
    job_title: "Desenvolvedor",
    company_name: "Tech Solutions",
    height_cm: 178,
    zodiac_sign: "Leão",
    verification_status: "verified",
    favorite_places: [],
    entry_type: "physical",
  },
  {
    user_id: "d7d3d0c6-5639-4857-8eda-005a9dcae592",
    name: "Lucas",
    age: 25,
    bio: "Fotógrafo e amante da natureza 📸🌲",
    intentions: ["dating", "friendship"],
    interests: ["photography_walk", "hiking_trail", "travel_addict"],
    photos: ["https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&h=800&fit=crop&crop=face"],
    job_title: "Fotógrafo",
    company_name: "Freelancer",
    height_cm: 182,
    zodiac_sign: "Aquário",
    verification_status: "verified",
    favorite_places: [],
    entry_type: "physical",
  },
  {
    user_id: "1f65a02d-5715-4be8-b71a-0a7d8f79d6ac",
    name: "Pedro",
    age: 29,
    bio: "Engenheiro por formação, músico por paixão 🎸",
    intentions: ["dating"],
    interests: ["live_music", "rock_bar", "tech_meetups"],
    photos: ["https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&h=800&fit=crop&crop=face"],
    job_title: "Engenheiro",
    company_name: "EngTech",
    height_cm: 175,
    zodiac_sign: "Virgem",
    verification_status: "verified",
    favorite_places: [],
    entry_type: "physical",
  },
  {
    user_id: "91d13ae6-8eae-47b4-8cad-853411b671d9",
    name: "Beatriz",
    age: 26,
    bio: "Design thinking e inovação 💡✨",
    intentions: ["friendship", "networking"],
    interests: ["content_creators", "yoga_alignment", "fashion_style"],
    photos: ["https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=800&fit=crop&crop=face"],
    job_title: "Designer UX",
    company_name: "Startup Lab",
    height_cm: 165,
    zodiac_sign: "Sagitário",
    verification_status: "verified",
    favorite_places: [],
    entry_type: "physical",
  },
  {
    user_id: "2903e31d-4071-4ad1-ba23-2fb3dbd25933",
    name: "Fernanda",
    age: 24,
    bio: "Jornalista curiosa e amante de histórias 📰🎙️",
    intentions: ["dating", "friendship"],
    interests: ["podcast_lover", "book_club", "cinema_indie"],
    photos: ["https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&h=800&fit=crop&crop=face"],
    job_title: "Jornalista",
    company_name: "Mídia News",
    height_cm: 168,
    zodiac_sign: "Gêmeos",
    verification_status: "verified",
    favorite_places: [],
    entry_type: "physical",
  },
  {
    user_id: "4f0b8872-cc6a-4301-b4f7-a18dd1259180",
    name: "Rafael",
    age: 30,
    bio: "Empreendedor e entusiasta de startups 🚀💼",
    intentions: ["networking"],
    interests: ["networking_pro", "tech_meetups", "gym_beast"],
    photos: ["https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=800&fit=crop&crop=face"],
    job_title: "Empresário",
    company_name: "Tech Ventures",
    height_cm: 180,
    zodiac_sign: "Capricórnio",
    verification_status: "verified",
    favorite_places: [],
    entry_type: "physical",
  },
  {
    user_id: "f018aaec-35b9-438c-90f2-4b6e62945ab3",
    name: "Thiago",
    age: 28,
    bio: "Arquiteto de soluções e fitness 🏗️💪",
    intentions: ["dating", "friendship"],
    interests: ["remote_work", "crossfit_community", "research_innovation"],
    photos: ["https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=600&h=800&fit=crop&crop=face"],
    job_title: "Arquiteto de Software",
    company_name: "Cloud Systems",
    height_cm: 176,
    zodiac_sign: "Escorpião",
    verification_status: "verified",
    favorite_places: [],
    entry_type: "physical",
  },
];

/**
 * Generate a mock presence record for the reviewer at any place.
 */
export function getMockPresenceForReviewer(placeId: string): PresenceRecord {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

  return {
    id: "reviewer-mock-presence",
    user_id: "9e5d5998-cba0-4e80-95bd-b3d94b241504", // reviewer UUID
    place_id: placeId,
    entered_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    ended_at: null,
    active: true,
    lat: -25.403060638964643, // Curitiba
    lng: -49.24663288211306,
  };
}

/**
 * Generate mock active users response for the reviewer at any place.
 * Returns all 7 fake users who haven't matched with the reviewer.
 */
export function getMockActiveUsersForReviewer(placeId: string): ActiveUsersResponse {
  // Add dynamic entered_at timestamps (staggered over last 30 min)
  const now = new Date();
  const usersWithTimestamps = MOCK_ACTIVE_USERS.map((user, index) => ({
    ...user,
    place_id: placeId,
    entered_at: new Date(now.getTime() - (index * 5 + 3) * 60 * 1000).toISOString(),
    expires_at: new Date(now.getTime() + (60 - index * 5) * 60 * 1000).toISOString(),
  }));

  return {
    place_id: placeId,
    count: usersWithTimestamps.length,
    users: usersWithTimestamps,
    liker_ids: [],
  };
}
