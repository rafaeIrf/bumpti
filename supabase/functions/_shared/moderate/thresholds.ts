/**
 * Moderation threshold configuration
 * 
 * TEXT thresholds are STRICTER because explicit terms in PT/ES get lower scores from OpenAI
 * IMAGE thresholds are LESS STRICT to avoid false positives on normal photos
 */

export const TEXT_THRESHOLDS = {
  SEXUAL: 0.15,       // Catches explicit terms in PT/ES (penis=0.37)
  VIOLENCE: 0.25,     // Violence references
  HARASSMENT: 0.25,   // Harassment, bullying
  HATE: 0.25,         // Hate speech
  SELF_HARM: 0.3,     // Self-harm references
} as const;

export const IMAGE_THRESHOLDS = {
  SEXUAL: 0.45,       // Higher - visual content scores higher
  VIOLENCE: 0.35,     // Weapons, gore
  HARASSMENT: 0.4,    // Offensive imagery
  HATE: 0.4,          // Hate symbols
  SELF_HARM: 0.5,     // Apple compliance
} as const;

/**
 * Checks if content scores exceed our sensitivity thresholds
 * Returns the reason if threshold is exceeded, null otherwise
 */
export function checkContentThresholds(
  scores: Record<string, number>,
  contentType: "text" | "image"
): string | null {
  const thresholds = contentType === "text" ? TEXT_THRESHOLDS : IMAGE_THRESHOLDS;

  // Sexual content (including minors and suggestive)
  const sexualScore = scores["sexual"] ?? 0;
  const sexualMinorsScore = scores["sexual/minors"] ?? 0;
  const sexualSuggestiveScore = scores["sexual/suggestive"] ?? 0;
  
  if (
    sexualScore > thresholds.SEXUAL || 
    sexualMinorsScore > thresholds.SEXUAL ||
    sexualSuggestiveScore > thresholds.SEXUAL
  ) {
    return "sensitive_content";
  }

  // Violence (weapons, gore, graphic content)
  const violenceScore = scores["violence"] ?? 0;
  const violenceGraphicScore = scores["violence/graphic"] ?? 0;
  
  if (violenceScore > thresholds.VIOLENCE || violenceGraphicScore > thresholds.VIOLENCE) {
    return "sensitive_content";
  }

  // Harassment and hate speech
  const harassmentScore = scores["harassment"] ?? 0;
  const harassmentThreateningScore = scores["harassment/threatening"] ?? 0;
  const hateScore = scores["hate"] ?? 0;
  const hateThreateningScore = scores["hate/threatening"] ?? 0;
  
  if (
    harassmentScore > thresholds.HARASSMENT ||
    harassmentThreateningScore > thresholds.HARASSMENT ||
    hateScore > thresholds.HATE ||
    hateThreateningScore > thresholds.HATE
  ) {
    return "sensitive_content";
  }

  // Self-harm (Apple compliance requirement)
  const selfHarmScore = scores["self-harm"] ?? 0;
  const selfHarmIntentScore = scores["self-harm/intent"] ?? 0;
  const selfHarmInstructionsScore = scores["self-harm/instructions"] ?? 0;
  
  if (
    selfHarmScore > thresholds.SELF_HARM ||
    selfHarmIntentScore > thresholds.SELF_HARM ||
    selfHarmInstructionsScore > thresholds.SELF_HARM
  ) {
    return "sensitive_content";
  }

  return null;
}
