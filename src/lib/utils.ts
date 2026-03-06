/**
 * Parses a price string (e.g., "¥1,200", "約3万円", "1500") into a numeric value.
 * Handles commas, '万' (10,000 multiplier), and extracts the first continuous number sequence.
 * 
 * @param priceString The string containing the price
 * @returns The parsed numeric value, or 0 if no valid number is found.
 */
export function parsePriceString(priceString?: string | null): number {
    if (!priceString) return 0;

    // Remove commas, whitespace, and currency symbols
    let sanitized = priceString.replace(/[,¥\\\s]/g, '');

    // Check for "万" (man = 10,000) multiplier
    const hasMan = sanitized.includes('万');

    // Extract the first sequence of digits (can include a decimal point)
    const match = sanitized.match(/\d+(\.\d+)?/);
    if (!match) return 0;

    let value = parseFloat(match[0]);

    if (hasMan) {
        value *= 10000;
    }

    return isNaN(value) ? 0 : value;
}
