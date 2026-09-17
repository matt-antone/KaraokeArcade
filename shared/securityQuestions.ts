// The questions a singer can pick for resetting a forgotten password. The
// server refuses any other text, so changing a question's wording here strands
// accounts that picked the old wording: add new ones rather than editing.
export const SECURITY_QUESTIONS = [
  'What was the name of your first pet?',
  'What city were you born in?',
  'What is your mother\'s maiden name?',
  'What was the name of your elementary school?',
  'What was the make of your first car?',
  'What street did you grow up on?',
  'What is the name of your childhood best friend?',
  'What was your childhood nickname?',
  'In what city did your parents meet?',
  'What was the first concert you attended?',
] as const
