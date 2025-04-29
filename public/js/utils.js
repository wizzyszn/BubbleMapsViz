// utils.js
export function shortenAddress(address) {
    if (!address) return '';
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
}

export function formatCurrency(value) {
    if (value == null) return '$0';
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            notation: 'compact',
            compactDisplay: 'short',
            maximumFractionDigits: 1
        }).format(value);
    }
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    }).format(value);
}
