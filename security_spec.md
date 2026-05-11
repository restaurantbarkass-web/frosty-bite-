# Security Specification - Frosty Bite

## 1. Data Invariants
- A profile can only be created by the owner of the UID.
- A user cannot set their own role to 'admin' or 'rider' unless verified against a system-level configuration or admin action.
- An order can only be created by a signed-in user (or 'guest' ID which is handled with limited privileges).
- A review can only be posted for an order that exists and was marked 'delivered' for that specific user.
- A wishlist item must belong to the user's uid.
- Timestamps must correspond to `request.time`.
- String fields must have `.size()` limits.

## 2. The Dirty Dozen (Vulnerability Test Payloads)

1. **Identity Spoofing**: Update user `full_name` but also try to change `role` to `admin`.
2. **Path Poisoning**: Create an order with a document ID that is 1MB of junk characters.
3. **State Shortcutting**: Update an order from `pending` straight to `delivered` as a customer.
4. **Phantom Review**: Post a review for an order ID that belongs to another user.
5. **Unauthorized Coupon Wipe**: Try to set `usage_count` of a coupon to `0` or `1000000`.
6. **Self-Verified Email**: Write to a user profile even if `email_verified` is false (if the rule requires it).
7. **Ghost Menu Item**: Create a new menu item as a guest user.
8. **Resource Exhaustion**: Post a comment in a review that is 10MB in size.
9. **Admin Escallation**: Create a document in `/admins/{uid}` to grant self-admin rights.
10. **Shadow Field Injection**: Update an order with an extra field `is_paid: true` not in the schema.
11. **PII Leak**: As a guest user, try to list all documents in the `users` collection.
12. **Relational Break**: Delete an order that is already in `out_for_delivery` state.

## 3. Test Runner Concept
The `firestore.rules` will be mathematically audited to reject these using `hasOnly()` and strict type/size checks.
