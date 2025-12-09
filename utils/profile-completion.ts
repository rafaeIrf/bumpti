import { ProfileData } from "@/modules/store/slices/profileSlice";

export function calculateProfileCompletion(profile: ProfileData | null): number {
  if (!profile) return 0;

  let score = 0;
  const maxScore = 100;

  // Photos (Max 15 points) - 5 points per photo up to 3
  const photoCount = profile.photos?.length || 0;
  score += Math.min(photoCount, 3) * 5;

  // Bio (10 points)
  if (profile.bio && profile.bio.length > 0) {
    score += 10;
  }

  // Intentions (10 points)
  if (profile.intentions && profile.intentions.length > 0) {
    score += 10;
  }

  // Connect With (10 points)
  if (profile.connectWith && profile.connectWith.length > 0) {
    score += 10;
  }

  // Favorite Places (15 points)
  if (profile.favoritePlaces && profile.favoritePlaces.length > 0) {
    score += 15;
  }

  // Optional Details (5 points each, max 40)
  const details = [
    profile.height_cm,
    profile.profession,
    profile.smoking_key,
    profile.education_key,
    profile.location,
    profile.zodiac_key,
    profile.relationship_key,
    profile.languages && profile.languages.length > 0,
  ];

  details.forEach((detail) => {
    if (detail) {
      score += 5;
    }
  });

  return Math.min(score, maxScore) / 100;
}
