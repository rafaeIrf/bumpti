export function calculateAge(birthdate?: string | null): number | null {
  if (!birthdate) return null;

  const birthDateObj = new Date(birthdate);
  if (Number.isNaN(birthDateObj.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDateObj.getFullYear();
  const monthDiff = today.getMonth() - birthDateObj.getMonth();
  const dayDiff = today.getDate() - birthDateObj.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}
