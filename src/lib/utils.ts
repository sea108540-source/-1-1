export function parsePriceString(priceString?: string | null): number {
    if (!priceString) return 0;

    const sanitized = priceString.replace(/[,\s円¥￥]/g, '');
    const hasMan = sanitized.includes('万');
    const match = sanitized.match(/\d+(\.\d+)?/);
    if (!match) return 0;

    let value = parseFloat(match[0]);
    if (hasMan) {
        value *= 10000;
    }

    return Number.isNaN(value) ? 0 : value;
}

export function formatPrice(price?: string | number | null): string {
    if (price === undefined || price === null || price === '') return '';

    if (typeof price === 'number') {
        return `${price.toLocaleString()}円`;
    }

    const num = parsePriceString(price);
    if (num > 0) {
        return `${num.toLocaleString()}円`;
    }

    return /[円¥￥]$/.test(price) ? price : `${price}円`;
}
