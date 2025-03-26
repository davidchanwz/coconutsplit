export function calculateEqualSplits(amount: number, memberCount: number): number[] {
    // Convert to cents to avoid floating point issues
    const totalCents = Math.round(amount * 100);
    const fairCents = Math.floor((amount / memberCount) * 100);

    // Calculate base splits
    const splits = new Array(memberCount).fill(fairCents);

    // Distribute remaining cents
    const remainingCents = totalCents - (fairCents * memberCount);
    for (let i = 0; i < remainingCents; i++) {
        splits[i % memberCount]++;
    }

    // Convert back to dollars
    return splits.map(cents => cents / 100);
}
