// Regler för användarnamn och lösenord. Används både i webbläsaren (så att
// redaktören ser vad som fattas) och på servern (som bestämmer).

export const PASSWORD_MIN = 6;

// Svar: en lista med det som fattas, tom om lösenordet duger.
export function passwordProblems(password) {
  const pw = String(password ?? '');
  const problems = [];
  if (pw.length < PASSWORD_MIN) problems.push(`minst ${PASSWORD_MIN} tecken`);
  if (!/\p{Lu}/u.test(pw)) problems.push('en stor bokstav');
  if (!/\p{Ll}/u.test(pw)) problems.push('en liten bokstav');
  if (!/\p{N}/u.test(pw)) problems.push('en siffra');
  if (!/[^\p{L}\p{N}\s]/u.test(pw)) problems.push('ett specialtecken, till exempel ! eller #');
  return problems;
}

export function describePasswordProblems(problems) {
  if (!problems.length) return '';
  const list = problems.length === 1 ? problems[0] : `${problems.slice(0, -1).join(', ')} och ${problems.at(-1)}`;
  return `Lösenordet behöver ${list}.`;
}

// Användarnamn: 3–40 tecken, bokstäver, siffror, punkt, bindestreck och
// understreck. Stora och små bokstäver räknas som samma.
export function normalizeUsername(name) {
  return String(name ?? '').trim().toLowerCase();
}

export function usernameProblem(name) {
  const n = normalizeUsername(name);
  if (n.length < 3) return 'Användarnamnet behöver minst 3 tecken.';
  if (n.length > 40) return 'Användarnamnet får vara högst 40 tecken.';
  if (!/^[\p{L}\p{N}._-]+$/u.test(n)) return 'Användarnamnet får bara innehålla bokstäver, siffror, punkt, bindestreck och understreck.';
  return '';
}
