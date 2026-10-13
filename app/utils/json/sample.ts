export const JSON_SAMPLE: string = `{
  "id": "ord_8f2k3",
  "status": "paid",
  "total": 42.5,
  "currency": "USD",
  "customer": { "name": "Ada Lovelace", "email": "ada@example.com", "vip": true },
  "items": [
    { "sku": "KB-01", "name": "Keyboard", "price": 30, "qty": 1 },
    { "sku": "MS-02", "name": "Mouse", "price": 12.5, "qty": 1 },
    { "sku": "PD-03", "name": "Mouse pad", "price": 4, "qty": 2 }
  ],
  "tags": ["priority", "gift"],
  "coupon": null,
  "createdAt": "2026-10-13T09:30:00Z"
}`

export const JSON_SAMPLE_RIGHT: string = `{
  "currency": "USD",
  "id": "ord_8f2k3",
  "status": "refunded",
  "total": 42.5,
  "customer": { "name": "Ada Lovelace", "email": "ada@example.com", "vip": true },
  "items": [
    { "sku": "KB-01", "name": "Keyboard", "price": 30, "qty": 1 },
    { "sku": "MS-02", "name": "Mouse", "price": 12.5, "qty": 2 },
    { "sku": "PD-03", "name": "Mouse pad", "price": 4, "qty": 2 }
  ],
  "tags": ["priority"],
  "coupon": null,
  "createdAt": "2026-10-13T09:30:00Z",
  "refundedAt": "2026-10-14T08:00:00Z"
}`

export const JSON_SAMPLE_QUERY: string = '$.items[?(@.price > 10)].name'
