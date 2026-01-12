/**
 * Get formatted full name from owner object
 * Format: "LastName, FirstName M." (with middle initial if present)
 */
export function getOwnerFullName(owner: {
  lastName: string
  firstName: string
  middleName?: string | null
}): string {
  if (!owner) return ''
  const middle = owner.middleName ? ` ${owner.middleName.charAt(0)}.` : ''
  return `${owner.lastName}, ${owner.firstName}${middle}`
}
