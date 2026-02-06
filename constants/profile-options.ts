export const EDUCATION_OPTIONS = [
  { id: "high_school_student", labelKey: "screens.profile.options.education.highSchoolStudent" },
  { id: "college_student", labelKey: "screens.profile.options.education.collegeStudent" },
  { id: "graduate", labelKey: "screens.profile.options.education.graduate" },
  { id: "postgraduate_student", labelKey: "screens.profile.options.education.postgraduateStudent" },
  { id: "postgraduate_degree", labelKey: "screens.profile.options.education.postgraduateDegree" },
  { id: "masters_student", labelKey: "screens.profile.options.education.mastersStudent" },
  { id: "masters_degree", labelKey: "screens.profile.options.education.mastersDegree" },
  { id: "doctorate_student", labelKey: "screens.profile.options.education.doctorateStudent" },
  { id: "doctorate_degree", labelKey: "screens.profile.options.education.doctorateDegree" },
];



export const ZODIAC_OPTIONS = [
  { id: "", labelKey: "screens.profile.options.zodiac.preferNotToSay" },
  { id: "aries", labelKey: "screens.profile.options.zodiac.aries" },
  { id: "taurus", labelKey: "screens.profile.options.zodiac.taurus" },
  { id: "gemini", labelKey: "screens.profile.options.zodiac.gemini" },
  { id: "cancer", labelKey: "screens.profile.options.zodiac.cancer" },
  { id: "leo", labelKey: "screens.profile.options.zodiac.leo" },
  { id: "virgo", labelKey: "screens.profile.options.zodiac.virgo" },
  { id: "libra", labelKey: "screens.profile.options.zodiac.libra" },
  { id: "scorpio", labelKey: "screens.profile.options.zodiac.scorpio" },
  { id: "sagittarius", labelKey: "screens.profile.options.zodiac.sagittarius" },
  { id: "capricorn", labelKey: "screens.profile.options.zodiac.capricorn" },
  { id: "aquarius", labelKey: "screens.profile.options.zodiac.aquarius" },
  { id: "pisces", labelKey: "screens.profile.options.zodiac.pisces" },
];

export const SMOKING_OPTIONS = [
  {
    id: "social",
    labelKey: "screens.profile.options.smoking.social",
  },
  {
    id: "no",
    labelKey: "screens.profile.options.smoking.no",
  },
  {
    id: "yes",
    labelKey: "screens.profile.options.smoking.yes",
  },
  {
    id: "quitting",
    labelKey: "screens.profile.options.smoking.quitting",
  },
];

export const GENDER_OPTIONS = [
  { id: "female", labelKey: "screens.profile.options.gender.female" },
  { id: "male", labelKey: "screens.profile.options.gender.male" },
  { id: "non-binary", labelKey: "screens.profile.options.gender.nonbinary" },
];

export const RELATIONSHIP_OPTIONS = [
  { id: "single", labelKey: "screens.profile.options.relationship.single" },
  { id: "dating", labelKey: "screens.profile.options.relationship.dating" },
  { id: "married", labelKey: "screens.profile.options.relationship.married" },
  { id: "open", labelKey: "screens.profile.options.relationship.open" },
  {
    id: "complicated",
    labelKey: "screens.profile.options.relationship.complicated",
  },
];

export const INTENTION_OPTIONS = [
  { id: "friendship", labelKey: "screens.onboarding.intentionFriends" },
  { id: "relationship", labelKey: "screens.onboarding.intentionDating" },
  { id: "casual", labelKey: "screens.onboarding.intentionCasual" },
  { id: "networking", labelKey: "screens.onboarding.intentionNetworking" },
];

export const CONNECT_WITH_OPTIONS = [
  { id: "female", labelKey: "screens.onboarding.connectWithFemale" },
  { id: "male", labelKey: "screens.onboarding.connectWithMale" },
  { id: "non-binary", labelKey: "screens.onboarding.connectWithNonBinary" },
  { id: "all", labelKey: "screens.onboarding.connectWithAll" },
];

// ---------------------------------------------------------------------------
// Interests / Vibes
// ---------------------------------------------------------------------------

export type InterestItem = {
  key: string;
  category: string;
  icon: string;
};

export type InterestCategory = {
  key: string;
  items: InterestItem[];
};

/**
 * 8 categories, 88 interests total.
 * Keys match the Supabase `interests` seed table exactly.
 * Translation keys follow the pattern:
 *   - Categories: `interests.categories.<category_key>`
 *   - Items: `interests.items.<interest_key>`
 */
export const INTEREST_CATEGORIES: InterestCategory[] = [
  {
    key: "cat_gastronomy",
    items: [
      { key: "brunch_time", category: "cat_gastronomy", icon: "🥐" },
      { key: "coffee_lovers", category: "cat_gastronomy", icon: "☕" },
      { key: "burger_beer", category: "cat_gastronomy", icon: "🍔" },
      { key: "sushi_experience", category: "cat_gastronomy", icon: "🍣" },
      { key: "wine_talks", category: "cat_gastronomy", icon: "🍷" },
      { key: "healthy_vibe", category: "cat_gastronomy", icon: "🥗" },
      { key: "street_food", category: "cat_gastronomy", icon: "🌮" },
      { key: "italian_dinner", category: "cat_gastronomy", icon: "🍝" },
      { key: "asian_cuisine", category: "cat_gastronomy", icon: "🍜" },
      { key: "nordestina", category: "cat_gastronomy", icon: "🫘" },
      { key: "churrasco", category: "cat_gastronomy", icon: "🥩" },
      { key: "desserts", category: "cat_gastronomy", icon: "🍫" },
      { key: "cocktails", category: "cat_gastronomy", icon: "🍹" },
    ],
  },
  {
    key: "cat_nightlife",
    items: [
      { key: "happy_hour", category: "cat_nightlife", icon: "🍻" },
      { key: "electronic_vibe", category: "cat_nightlife", icon: "🎧" },
      { key: "samba_pagode", category: "cat_nightlife", icon: "🪘" },
      { key: "rooftop_drinks", category: "cat_nightlife", icon: "🍸" },
      { key: "underground_clubs", category: "cat_nightlife", icon: "💃" },
      { key: "karaoke_night", category: "cat_nightlife", icon: "🎤" },
      { key: "live_music", category: "cat_nightlife", icon: "🎸" },
      { key: "sertanejo", category: "cat_nightlife", icon: "🤠" },
      { key: "rock_bar", category: "cat_nightlife", icon: "🤘" },
      { key: "funk_baile", category: "cat_nightlife", icon: "🔊" },
      { key: "open_bar", category: "cat_nightlife", icon: "🥂" },
    ],
  },
  {
    key: "cat_fitness",
    items: [
      { key: "beach_tennis", category: "cat_fitness", icon: "🎾" },
      { key: "gym_beast", category: "cat_fitness", icon: "🏋️‍♂️" },
      { key: "running_crew", category: "cat_fitness", icon: "🏃‍♂️" },
      { key: "cycling_life", category: "cat_fitness", icon: "🚴‍♂️" },
      { key: "yoga_alignment", category: "cat_fitness", icon: "🧘" },
      { key: "crossfit_community", category: "cat_fitness", icon: "🤸‍♂️" },
      { key: "skate_longboard", category: "cat_fitness", icon: "🛹" },
      { key: "futebol", category: "cat_fitness", icon: "⚽" },
      { key: "futevolei", category: "cat_fitness", icon: "🏐" },
      { key: "surf", category: "cat_fitness", icon: "🏄" },
      { key: "swimming", category: "cat_fitness", icon: "🏊" },
      { key: "martial_arts", category: "cat_fitness", icon: "🥊" },
    ],
  },
  {
    key: "cat_lifestyle",
    items: [
      { key: "pet_friendly", category: "cat_lifestyle", icon: "🐶" },
      { key: "tech_innovation", category: "cat_lifestyle", icon: "💻" },
      { key: "content_creators", category: "cat_lifestyle", icon: "📸" },
      { key: "remote_work", category: "cat_lifestyle", icon: "👨‍💻" },
      { key: "travel_addict", category: "cat_lifestyle", icon: "✈️" },
      { key: "gaming_culture", category: "cat_lifestyle", icon: "🎮" },
      { key: "fashion_style", category: "cat_lifestyle", icon: "👟" },
      { key: "networking_pro", category: "cat_lifestyle", icon: "🤝" },
      { key: "astrology", category: "cat_lifestyle", icon: "🔮" },
      { key: "self_care", category: "cat_lifestyle", icon: "🧖" },
      { key: "vinyl_music", category: "cat_lifestyle", icon: "🎵" },
    ],
  },
  {
    key: "cat_culture",
    items: [
      { key: "museum_expo", category: "cat_culture", icon: "🖼️" },
      { key: "book_club", category: "cat_culture", icon: "📚" },
      { key: "cinema_indie", category: "cat_culture", icon: "🎬" },
      { key: "language_exchange", category: "cat_culture", icon: "🗣️" },
      { key: "photography_walk", category: "cat_culture", icon: "📷" },
      { key: "street_art", category: "cat_culture", icon: "🎨" },
      { key: "library_focus", category: "cat_culture", icon: "🤫" },
      { key: "coffee_study", category: "cat_culture", icon: "📖" },
      { key: "research_innovation", category: "cat_culture", icon: "🔬" },
      { key: "theater_standup", category: "cat_culture", icon: "🎭" },
      { key: "podcast_lover", category: "cat_culture", icon: "🎙️" },
      { key: "anime_manga", category: "cat_culture", icon: "🎌" },
      { key: "board_games", category: "cat_culture", icon: "🎲" },
    ],
  },
  {
    key: "cat_outdoors",
    items: [
      { key: "hiking_trail", category: "cat_outdoors", icon: "🥾" },
      { key: "sunset_lover", category: "cat_outdoors", icon: "🌅" },
      { key: "picnic_park", category: "cat_outdoors", icon: "🧺" },
      { key: "beach_vibe", category: "cat_outdoors", icon: "🏖️" },
      { key: "camping_life", category: "cat_outdoors", icon: "🏕️" },
      { key: "climbing", category: "cat_outdoors", icon: "🧗" },
      { key: "road_trip", category: "cat_outdoors", icon: "🚗" },
      { key: "gardening", category: "cat_outdoors", icon: "🌿" },
      { key: "fishing", category: "cat_outdoors", icon: "🎣" },
    ],
  },
  {
    key: "cat_events",
    items: [
      { key: "match_day", category: "cat_events", icon: "⚽" },
      { key: "sports_fan", category: "cat_events", icon: "🏆" },
      { key: "arena_shows", category: "cat_events", icon: "🏟️" },
      { key: "festivals_concerts", category: "cat_events", icon: "🎉" },
      { key: "exhibitions_fairs", category: "cat_events", icon: "🎟️" },
      { key: "sports_bar", category: "cat_events", icon: "🍺" },
      { key: "tech_meetups", category: "cat_events", icon: "🚀" },
      { key: "carnival", category: "cat_events", icon: "🎊" },
      { key: "food_festivals", category: "cat_events", icon: "🍽️" },
    ],
  },
  {
    key: "cat_values",
    items: [
      { key: "lgbtq_ally", category: "cat_values", icon: "🏳️‍🌈" },
      { key: "sustainability", category: "cat_values", icon: "♻️" },
      { key: "animal_cause", category: "cat_values", icon: "🐾" },
      { key: "feminism", category: "cat_values", icon: "✊" },
      { key: "volunteering", category: "cat_values", icon: "💛" },
      { key: "mental_health", category: "cat_values", icon: "🧠" },
      { key: "body_positive", category: "cat_values", icon: "💪" },
      { key: "vegan_lifestyle", category: "cat_values", icon: "🌱" },
      { key: "faith_spirituality", category: "cat_values", icon: "🙏" },
      { key: "antiracism", category: "cat_values", icon: "✊🏾" },
    ],
  },
];

/** Flat list of all interests across all categories */
export const ALL_INTERESTS: InterestItem[] = INTEREST_CATEGORIES.flatMap(
  (cat) => cat.items
);

/** Minimum number of interests required */
export const MIN_INTERESTS = 3;

/** Maximum number of interests allowed */
export const MAX_INTERESTS = 10;
